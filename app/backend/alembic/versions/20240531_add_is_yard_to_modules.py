"""
Revision for adding is_yard boolean field to modules table
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('modules', sa.Column('is_yard', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column('modules', 'is_yard', server_default=None)

def downgrade():
    op.drop_column('modules', 'is_yard')
