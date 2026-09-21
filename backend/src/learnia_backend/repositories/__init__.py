"""
Repository layer: one class per entity, wrapping data-access queries so
services never call SQLAlchemy directly (see 02-architecture, decision 5).

Deliberately empty for now — the first real repository (CourseRepository)
is added in 05-course-system, once there's a real entity to wrap instead
of a throwaway demo one.
"""
