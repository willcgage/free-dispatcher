"""
Remove layout_districts and layout_district_modules tables
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.drop_table('layout_district_modules')
    op.drop_table('layout_districts')

def downgrade():
    op.create_table(
        'layout_districts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('layout_id', sa.Integer(), nullable=False),
        sa.Column('district_id', sa.Integer(), nullable=False),
    )
    op.create_table(
        'layout_district_modules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('layout_district_id', sa.Integer(), nullable=False),
        sa.Column('module_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('owner_name', sa.String(), nullable=True),
        sa.Column('owner_email', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('number_of_endplates', sa.Integer(), nullable=True),
    )
