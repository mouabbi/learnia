"""add is_admin to users

Revision ID: a1c2e5f9b301
Revises: 74399404aefa
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c2e5f9b301'
down_revision: Union[str, Sequence[str], None] = '74399404aefa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_admin')
