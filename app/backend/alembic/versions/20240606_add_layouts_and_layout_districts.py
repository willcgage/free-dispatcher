"""
Add Layouts, LayoutDistricts, LayoutDistrictModules tables and drop Modules/ModuleEndplates
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

def upgrade():
    op.create_table(
        'layouts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('key', sa.String(), unique=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('start_date', sa.String(), nullable=True),
        sa.Column('end_date', sa.String(), nullable=True),
        sa.Column('location_city', sa.String(), nullable=True),
        sa.Column('location_state', sa.String(), nullable=True),
    )
    op.create_table(
        'layout_districts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('layout_id', sa.Integer(), sa.ForeignKey('layouts.id'), nullable=False),
        sa.Column('district_id', sa.Integer(), sa.ForeignKey('districts.id'), nullable=False),
    )
    op.create_table(
        'layout_district_modules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('layout_district_id', sa.Integer(), sa.ForeignKey('layout_districts.id'), nullable=False),
        sa.Column('module_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('owner_name', sa.String(), nullable=True),
        sa.Column('owner_email', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('number_of_endplates', sa.Integer(), nullable=True),
    )
    # Drop module_endplates before modules, and use IF EXISTS for safety
    op.execute('DROP TABLE IF EXISTS module_endplates CASCADE')
    op.execute('DROP TABLE IF EXISTS modules CASCADE')

def downgrade():
    op.create_table(
        'modules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('district_id', sa.Integer(), sa.ForeignKey('districts.id'), nullable=False, default=1),
        sa.Column('number_of_endplates', sa.Integer(), nullable=False, default=1),
        sa.Column('owner', sa.String(), nullable=True),
        sa.Column('owner_email', sa.String(), nullable=True),
        sa.Column('is_yard', sa.Boolean(), nullable=False, default=False),
    )
    op.create_table(
        'module_endplates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('module_id', sa.Integer(), sa.ForeignKey('modules.id'), nullable=False),
        sa.Column('endplate_number', sa.Integer(), nullable=False),
        sa.Column('connected_module_id', sa.Integer(), sa.ForeignKey('modules.id'), nullable=True),
    )
    op.execute('DROP TABLE IF EXISTS layout_district_modules CASCADE')
    op.execute('DROP TABLE IF EXISTS layout_districts CASCADE')
    op.execute('DROP TABLE IF EXISTS layouts CASCADE')
