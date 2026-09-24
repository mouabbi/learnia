"""add content_seen_at to learning_progress

Revision ID: d4e6a9c1f230
Revises: a1c2e5f9b301
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e6a9c1f230'
down_revision: Union[str, Sequence[str], None] = 'a1c2e5f9b301'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('learning_progress', sa.Column('content_seen_at', sa.DateTime(), nullable=True))
    # Backfill existing rows to their own updated_at, so a learner who was
    # already partway through a course before this feature shipped doesn't
    # suddenly see an "updated" badge for edits made before they ever
    # started — only genuinely new changes (from here on) should count.
    op.execute('UPDATE learning_progress SET content_seen_at = updated_at')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('learning_progress', 'content_seen_at')
