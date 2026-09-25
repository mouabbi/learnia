"""
Zip transport for the "Generate All" flow. The AI returns ONE zip instead of
one pasted JSON blob:

    <anything>.zip
      01-intro-to-docker/          one folder per module
        content.json               ModuleContentJSON  (optional)
        quiz.json                  list[QuestionWriteRequest] (optional)
        <media files>              ignored for now
      02-images-and-layers/
        ...
      final-exam.json              list[QuestionWriteRequest] (optional, root only)

This module only unpacks + maps folders to modules and rebuilds the same
combined {moduleContent, moduleQcm, finalExam} JSON the paste flow uses, so
validation/commit stay in ImportService.validate_batch/commit_batch — one
source of truth for what "valid" means. Everything is read in memory; nothing
is ever extracted to disk (so no path-traversal surface).
"""

import io
import json
import re
import zipfile
from dataclasses import dataclass, field

from learnia_backend.exceptions import ValidationAppError
from learnia_backend.models.module import Module
from learnia_backend.schemas.import_validation import ImportFieldError

MAX_ZIP_BYTES = 20 * 1024 * 1024
MAX_JSON_FILE_BYTES = 10 * 1024 * 1024
MAX_TOTAL_JSON_BYTES = 50 * 1024 * 1024

CONTENT_FILE = "content.json"
QUIZ_FILE = "quiz.json"
FINAL_EXAM_FILE = "final-exam.json"

# Tolerated alternate spellings an AI tool might produce.
_CONTENT_NAMES = {"content", "modulecontent", "lessons"}
_QUIZ_NAMES = {"quiz", "qcm", "questions", "modulequiz"}
_FINAL_EXAM_NAMES = {"finalexam", "exam", "final"}

_JUNK = re.compile(r"(^|/)(__MACOSX|\.DS_Store|Thumbs\.db)(/|$)")


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "module"


def module_folder_name(module: Module) -> str:
    """The exact folder name the prompt tells the AI to use for a module —
    shared with services/prompt_builder.py so the two can't drift."""
    return f"{module.position + 1:02d}-{slugify(module.title)}"


def _file_key(filename: str) -> str:
    stem = filename.rsplit(".", 1)[0]
    return re.sub(r"[^a-z0-9]", "", stem.lower())


@dataclass
class ZipModuleMapping:
    folder: str
    module_id: str | None
    module_title: str | None
    has_content: bool = False
    has_quiz: bool = False
    ignored_files: list[str] = field(default_factory=list)


@dataclass
class UnpackedBatchZip:
    payload: dict
    module_content_ids: list[str]
    module_qcm_ids: list[str]
    include_final_exam: bool
    mappings: list[ZipModuleMapping]
    errors: list[ImportFieldError]
    warnings: list[str]
    # "moduleContent.12" -> "01-intro/content.json", for rewriting validation
    # error paths into something the user can find inside their zip.
    source_paths: dict[str, str]


def _match_module(folder: str, modules: list[Module]) -> Module | None:
    lowered = folder.lower()
    for m in modules:
        if module_folder_name(m) == lowered:
            return m
    # Same title, whatever the numeric prefix.
    title_slug = slugify(re.sub(r"^\d+[\s._-]*", "", folder))
    for m in modules:
        if slugify(m.title) == title_slug:
            return m
    # Fall back to the numeric prefix = module position.
    prefix = re.match(r"^(\d+)", folder)
    if prefix:
        pos = int(prefix.group(1)) - 1
        for m in modules:
            if m.position == pos:
                return m
    return None


def _strip_wrapper_dir(names: list[str]) -> list[tuple[str, str]]:
    """Zipping a folder (instead of its contents) adds one wrapper directory;
    peel it off when EVERYTHING sits under the same top-level folder and
    that folder itself contains subfolders (i.e. it's not a module folder)."""
    pairs = [(n, n) for n in names]
    firsts = {n.split("/", 1)[0] for n in names}
    if len(firsts) == 1 and all("/" in n for n in names):
        inner = [n.split("/", 1)[1] for n in names]
        if any("/" in n for n in inner):
            return list(zip(names, inner, strict=True))
    return pairs


def unpack_batch_zip(data: bytes, modules: list[Module]) -> UnpackedBatchZip:
    if len(data) > MAX_ZIP_BYTES:
        raise ValidationAppError(f"Zip is too large (max {MAX_ZIP_BYTES // (1024 * 1024)} MB)")
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ValidationAppError("That file is not a valid .zip archive") from exc

    errors: list[ImportFieldError] = []
    warnings: list[str] = []
    payload: dict = {}
    source_paths: dict[str, str] = {}
    mappings: dict[str, ZipModuleMapping] = {}
    module_content: dict = {}
    module_qcm: dict = {}
    total_json = 0

    with archive:
        infos = {
            i.filename: i
            for i in archive.infolist()
            if not i.is_dir() and not _JUNK.search(i.filename)
        }
        for original, path in _strip_wrapper_dir(sorted(infos)):
            info = infos[original]
            parts = path.split("/")
            is_json = parts[-1].lower().endswith(".json")

            def read_json(display: str, info: zipfile.ZipInfo = info) -> object:
                nonlocal total_json
                if info.file_size > MAX_JSON_FILE_BYTES:
                    errors.append(ImportFieldError(field=display, message="File too large"))
                    return None
                total_json += info.file_size
                if total_json > MAX_TOTAL_JSON_BYTES:
                    raise ValidationAppError("Zip contents are too large")
                try:
                    return json.loads(archive.read(info).decode("utf-8-sig"))
                except (ValueError, UnicodeDecodeError) as exc:
                    errors.append(ImportFieldError(field=display, message=f"Invalid JSON: {exc}"))
                    return None

            if len(parts) == 1:
                if is_json and _file_key(parts[0]) in _FINAL_EXAM_NAMES:
                    if "finalExam" in payload:
                        warnings.append(f"Extra final exam file ignored: {path}")
                        continue
                    parsed = read_json(path)
                    if parsed is not None:
                        payload["finalExam"] = parsed
                        source_paths["finalExam"] = path
                else:
                    warnings.append(f"Ignored file at zip root: {path}")
                continue

            if len(parts) > 2:
                folder = parts[0]
                mapping = mappings.get(folder)
                if mapping is not None:
                    mapping.ignored_files.append("/".join(parts[1:]))
                else:
                    warnings.append(f"Ignored nested file: {path}")
                continue

            folder, filename = parts
            mapping = mappings.get(folder)
            if mapping is None:
                module = _match_module(folder, modules)
                mapping = ZipModuleMapping(
                    folder=folder,
                    module_id=str(module.id) if module else None,
                    module_title=module.title if module else None,
                )
                mappings[folder] = mapping
                if module is None:
                    errors.append(
                        ImportFieldError(
                            field=f"{folder}/",
                            message="Folder doesn't match any module in this course",
                        )
                    )

            key = _file_key(filename)
            if not is_json or key not in _CONTENT_NAMES | _QUIZ_NAMES:
                mapping.ignored_files.append(filename)
                continue
            if mapping.module_id is None:
                continue

            mid = mapping.module_id
            if key in _CONTENT_NAMES:
                if mid in module_content:
                    errors.append(
                        ImportFieldError(field=path, message="Duplicate content for this module")
                    )
                    continue
                parsed = read_json(path)
                if parsed is not None:
                    module_content[mid] = parsed
                    source_paths[f"moduleContent.{mid}"] = path
                    mapping.has_content = True
            else:
                if mid in module_qcm:
                    errors.append(
                        ImportFieldError(field=path, message="Duplicate quiz for this module")
                    )
                    continue
                parsed = read_json(path)
                if parsed is not None:
                    module_qcm[mid] = parsed
                    source_paths[f"moduleQcm.{mid}"] = path
                    mapping.has_quiz = True

    if module_content:
        payload["moduleContent"] = module_content
    if module_qcm:
        payload["moduleQcm"] = module_qcm

    # Two folders resolving to the same module is almost certainly a mistake.
    seen: dict[str, str] = {}
    for m in mappings.values():
        if m.module_id is None:
            continue
        if m.module_id in seen:
            errors.append(
                ImportFieldError(
                    field=f"{m.folder}/",
                    message=f"Maps to the same module as {seen[m.module_id]}/",
                )
            )
        seen[m.module_id] = m.folder

    if not payload and not errors:
        errors.append(
            ImportFieldError(
                field="(zip)",
                message=f"No {CONTENT_FILE}, {QUIZ_FILE} or {FINAL_EXAM_FILE} found in the zip",
            )
        )

    return UnpackedBatchZip(
        payload=payload,
        module_content_ids=list(module_content),
        module_qcm_ids=list(module_qcm),
        include_final_exam="finalExam" in payload,
        mappings=list(mappings.values()),
        errors=errors,
        warnings=warnings,
        source_paths=source_paths,
    )


def to_zip_error_paths(
    errors: list[ImportFieldError], source_paths: dict[str, str]
) -> list[ImportFieldError]:
    """Rewrite "moduleContent.12.pages.0.blocks" -> "01-intro/content.json:
    pages.0.blocks" so an error points at a file the user can open."""
    out = []
    for err in errors:
        field_name = err.field
        for prefix, path in source_paths.items():
            if field_name == prefix or field_name.startswith(prefix + "."):
                rest = field_name[len(prefix) :].lstrip(".")
                field_name = f"{path}: {rest}" if rest else path
                break
        out.append(ImportFieldError(field=field_name, message=err.message))
    return out
