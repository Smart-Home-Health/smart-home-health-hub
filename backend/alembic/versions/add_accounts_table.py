"""Add accounts table and account_id to all tenant tables

Revision ID: add_accounts_001
Revises: dd662365b6ff
Create Date: 2026-02-07

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision: str = 'add_accounts_001'
down_revision: Union[str, None] = 'dd662365b6ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create accounts table
    op.create_table(
        'accounts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('settings', sa.JSON(), nullable=True),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('timezone', sa.String(50), nullable=False, default='America/New_York'),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_accounts_id', 'accounts', ['id'])
    op.create_index('ix_accounts_slug', 'accounts', ['slug'], unique=True)
    op.create_index('ix_accounts_organization_id', 'accounts', ['organization_id'])
    
    # Insert default account under the default organization
    # Password: Test12345 (bcrypt hash)
    op.execute("""
        INSERT INTO accounts (organization_id, name, slug, password_hash, is_default, is_active, timezone, created_at, updated_at)
        SELECT id, 'Default Account', 'default', '$2b$12$D99gtnZndqKWmnU.HgkfeOzaiLffXAL7wgsrRx4JIFxqXAI7K9YCu', true, true, 'America/New_York', NOW(), NOW()
        FROM organizations WHERE is_default = true
        LIMIT 1
    """)
    
    # If no default org exists, create account without org link
    op.execute("""
        INSERT INTO accounts (name, slug, password_hash, is_default, is_active, timezone, created_at, updated_at)
        SELECT 'Default Account', 'default', '$2b$12$D99gtnZndqKWmnU.HgkfeOzaiLffXAL7wgsrRx4JIFxqXAI7K9YCu', true, true, 'America/New_York', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE is_default = true)
    """)
    
    # Add account_id column to users table
    op.add_column('users', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_users_account_id', 'users', ['account_id'])
    op.create_foreign_key('fk_users_account_id', 'users', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    
    # Update existing users to belong to default account
    op.execute("""
        UPDATE users SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1)
        WHERE account_id IS NULL
    """)
    
    # Add account_id to patients table
    op.add_column('patients', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_patients_account_id', 'patients', ['account_id'])
    op.create_foreign_key('fk_patients_account_id', 'patients', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE patients SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to equipment table
    op.add_column('equipment', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_equipment_account_id', 'equipment', ['account_id'])
    op.create_foreign_key('fk_equipment_account_id', 'equipment', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE equipment SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to medication table
    op.add_column('medication', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_medication_account_id', 'medication', ['account_id'])
    op.create_foreign_key('fk_medication_account_id', 'medication', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE medication SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to care_task table
    op.add_column('care_task', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_care_task_account_id', 'care_task', ['account_id'])
    op.create_foreign_key('fk_care_task_account_id', 'care_task', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE care_task SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to care_task_category table
    op.add_column('care_task_category', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_care_task_category_account_id', 'care_task_category', ['account_id'])
    op.create_foreign_key('fk_care_task_category_account_id', 'care_task_category', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE care_task_category SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to businesses table
    op.add_column('businesses', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_businesses_account_id', 'businesses', ['account_id'])
    op.create_foreign_key('fk_businesses_account_id', 'businesses', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE businesses SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to providers table
    op.add_column('providers', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_providers_account_id', 'providers', ['account_id'])
    op.create_foreign_key('fk_providers_account_id', 'providers', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE providers SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to vitals table
    op.add_column('vitals', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_vitals_account_id', 'vitals', ['account_id'])
    op.create_foreign_key('fk_vitals_account_id', 'vitals', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE vitals SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to symptoms table
    op.add_column('symptoms', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_symptoms_account_id', 'symptoms', ['account_id'])
    op.create_foreign_key('fk_symptoms_account_id', 'symptoms', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE symptoms SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to dme_shipments table
    op.add_column('dme_shipments', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_dme_shipments_account_id', 'dme_shipments', ['account_id'])
    op.create_foreign_key('fk_dme_shipments_account_id', 'dme_shipments', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE dme_shipments SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to diagnoses table
    op.add_column('diagnoses', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_diagnoses_account_id', 'diagnoses', ['account_id'])
    op.create_foreign_key('fk_diagnoses_account_id', 'diagnoses', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE diagnoses SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to implants table
    op.add_column('implants', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_implants_account_id', 'implants', ['account_id'])
    op.create_foreign_key('fk_implants_account_id', 'implants', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE implants SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to monitoring_alerts table
    op.add_column('monitoring_alerts', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_monitoring_alerts_account_id', 'monitoring_alerts', ['account_id'])
    op.create_foreign_key('fk_monitoring_alerts_account_id', 'monitoring_alerts', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE monitoring_alerts SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to nutrition_goals table
    op.add_column('nutrition_goals', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_nutrition_goals_account_id', 'nutrition_goals', ['account_id'])
    op.create_foreign_key('fk_nutrition_goals_account_id', 'nutrition_goals', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE nutrition_goals SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Add account_id to nutrition_intake table
    op.add_column('nutrition_intake', sa.Column('account_id', sa.Integer(), nullable=True))
    op.create_index('ix_nutrition_intake_account_id', 'nutrition_intake', ['account_id'])
    op.create_foreign_key('fk_nutrition_intake_account_id', 'nutrition_intake', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')
    op.execute("UPDATE nutrition_intake SET account_id = (SELECT id FROM accounts WHERE is_default = true LIMIT 1) WHERE account_id IS NULL")
    
    # Modify settings table to have account_id and id primary key
    # First check if settings has the old structure
    op.add_column('settings', sa.Column('id', sa.Integer(), autoincrement=True, nullable=True))
    op.add_column('settings', sa.Column('account_id', sa.Integer(), nullable=True))
    
    # Update id for existing rows
    op.execute("UPDATE settings SET id = (SELECT COALESCE(MAX(id), 0) + ROW_NUMBER() OVER () FROM settings s2 WHERE s2.key = settings.key)")
    
    # Make id NOT NULL and set as primary key
    op.alter_column('settings', 'id', nullable=False)
    op.create_index('ix_settings_account_id', 'settings', ['account_id'])
    op.create_index('ix_settings_key', 'settings', ['key'])
    op.create_foreign_key('fk_settings_account_id', 'settings', 'accounts', ['account_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    # Remove account_id from all tables (in reverse order)
    
    # Settings - remove new columns
    op.drop_constraint('fk_settings_account_id', 'settings', type_='foreignkey')
    op.drop_index('ix_settings_account_id', 'settings')
    op.drop_index('ix_settings_key', 'settings')
    op.drop_column('settings', 'account_id')
    op.drop_column('settings', 'id')
    
    # Nutrition intake
    op.drop_constraint('fk_nutrition_intake_account_id', 'nutrition_intake', type_='foreignkey')
    op.drop_index('ix_nutrition_intake_account_id', 'nutrition_intake')
    op.drop_column('nutrition_intake', 'account_id')
    
    # Nutrition goals
    op.drop_constraint('fk_nutrition_goals_account_id', 'nutrition_goals', type_='foreignkey')
    op.drop_index('ix_nutrition_goals_account_id', 'nutrition_goals')
    op.drop_column('nutrition_goals', 'account_id')
    
    # Monitoring alerts
    op.drop_constraint('fk_monitoring_alerts_account_id', 'monitoring_alerts', type_='foreignkey')
    op.drop_index('ix_monitoring_alerts_account_id', 'monitoring_alerts')
    op.drop_column('monitoring_alerts', 'account_id')
    
    # Implants
    op.drop_constraint('fk_implants_account_id', 'implants', type_='foreignkey')
    op.drop_index('ix_implants_account_id', 'implants')
    op.drop_column('implants', 'account_id')
    
    # Diagnoses
    op.drop_constraint('fk_diagnoses_account_id', 'diagnoses', type_='foreignkey')
    op.drop_index('ix_diagnoses_account_id', 'diagnoses')
    op.drop_column('diagnoses', 'account_id')
    
    # DME Shipments
    op.drop_constraint('fk_dme_shipments_account_id', 'dme_shipments', type_='foreignkey')
    op.drop_index('ix_dme_shipments_account_id', 'dme_shipments')
    op.drop_column('dme_shipments', 'account_id')
    
    # Symptoms
    op.drop_constraint('fk_symptoms_account_id', 'symptoms', type_='foreignkey')
    op.drop_index('ix_symptoms_account_id', 'symptoms')
    op.drop_column('symptoms', 'account_id')
    
    # Vitals
    op.drop_constraint('fk_vitals_account_id', 'vitals', type_='foreignkey')
    op.drop_index('ix_vitals_account_id', 'vitals')
    op.drop_column('vitals', 'account_id')
    
    # Providers
    op.drop_constraint('fk_providers_account_id', 'providers', type_='foreignkey')
    op.drop_index('ix_providers_account_id', 'providers')
    op.drop_column('providers', 'account_id')
    
    # Businesses
    op.drop_constraint('fk_businesses_account_id', 'businesses', type_='foreignkey')
    op.drop_index('ix_businesses_account_id', 'businesses')
    op.drop_column('businesses', 'account_id')
    
    # Care task category
    op.drop_constraint('fk_care_task_category_account_id', 'care_task_category', type_='foreignkey')
    op.drop_index('ix_care_task_category_account_id', 'care_task_category')
    op.drop_column('care_task_category', 'account_id')
    
    # Care task
    op.drop_constraint('fk_care_task_account_id', 'care_task', type_='foreignkey')
    op.drop_index('ix_care_task_account_id', 'care_task')
    op.drop_column('care_task', 'account_id')
    
    # Medication
    op.drop_constraint('fk_medication_account_id', 'medication', type_='foreignkey')
    op.drop_index('ix_medication_account_id', 'medication')
    op.drop_column('medication', 'account_id')
    
    # Equipment
    op.drop_constraint('fk_equipment_account_id', 'equipment', type_='foreignkey')
    op.drop_index('ix_equipment_account_id', 'equipment')
    op.drop_column('equipment', 'account_id')
    
    # Patients
    op.drop_constraint('fk_patients_account_id', 'patients', type_='foreignkey')
    op.drop_index('ix_patients_account_id', 'patients')
    op.drop_column('patients', 'account_id')
    
    # Users
    op.drop_constraint('fk_users_account_id', 'users', type_='foreignkey')
    op.drop_index('ix_users_account_id', 'users')
    op.drop_column('users', 'account_id')
    
    # Drop accounts table
    op.drop_index('ix_accounts_organization_id', 'accounts')
    op.drop_index('ix_accounts_slug', 'accounts')
    op.drop_index('ix_accounts_id', 'accounts')
    op.drop_table('accounts')
