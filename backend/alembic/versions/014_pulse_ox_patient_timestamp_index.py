"""Add (patient_id, timestamp) index on pulse_ox_data

Revision ID: 014_pulse_ox_idx
Revises: 013_symptoms
Create Date: 2026-05-12

The /api/vitals/patient/{id}/pulse-ox-summary aggregation scans a per-patient
time window with a stuck-sensor filter implemented as window functions.
Without this index the planner falls back to a seq scan over the whole table
(~1M+ rows per patient) and the endpoint takes ~750ms+ to respond.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '014_pulse_ox_idx'
down_revision: Union[str, None] = '013_symptoms'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_pulse_ox_data_patient_timestamp',
        'pulse_ox_data',
        ['patient_id', 'timestamp'],
    )


def downgrade() -> None:
    op.drop_index('ix_pulse_ox_data_patient_timestamp', table_name='pulse_ox_data')
