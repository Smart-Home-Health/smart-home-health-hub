import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import AdminV2Layout from './AdminV2Layout';
import config from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminPatient } from '../../contexts/AdminPatientContext';
import { XIcon, SearchIcon } from '../../components/Icons';
import './AdminV2.css';

const AdminV2Vitals = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { selectedPatient: contextPatient } = useAdminPatient();

  const selectedPatient = contextPatient;
  const isHistoryView = location.pathname.includes('/history');

  const getLocalDateTimeString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  };

  const [vitalsFormData, setVitalsFormData] = useState({
    heart_rate: '',
    spo2: '',
    respiratory_rate: '',
    temperature: '',
    weight: '',
    systolic: '',
    diastolic: '',
    notes: '',
    timestamp: getLocalDateTimeString()
  });

  const [activeVitals, setActiveVitals] = useState({
    blood_pressure: false,
    heart_rate: false,
    spo2: false,
    respiratory_rate: false,
    temperature: false,
    weight: false
  });

  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Custom vitals state
  const [customDefinitions, setCustomDefinitions] = useState([]);
  const [customVitalsData, setCustomVitalsData] = useState({});
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomUnit, setNewCustomUnit] = useState('');
  const [showCustomManager, setShowCustomManager] = useState(false);
  const [customDefError, setCustomDefError] = useState(null);

  const builtInVitalTypes = [
    { value: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg' },
    { value: 'heart_rate', label: 'Heart Rate', unit: 'bpm' },
    { value: 'spo2', label: 'SpO2', unit: '%' },
    { value: 'temperature', label: 'Temperature', unit: '°F' },
    { value: 'respiratory_rate', label: 'Respiratory Rate', unit: '/min' },
    { value: 'weight', label: 'Weight', unit: 'lbs' },
  ];

  const allVitalTypes = useMemo(() => [
    ...builtInVitalTypes,
    ...customDefinitions.map(d => ({
      value: d.name,
      label: d.display_label,
      unit: d.unit || '',
      isCustom: true,
      definitionId: d.id,
    }))
  ], [customDefinitions]);

  const toggleVital = (vitalKey) => {
    setActiveVitals(prev => ({ ...prev, [vitalKey]: !prev[vitalKey] }));
  };

  // Fetch custom vital definitions when patient changes
  useEffect(() => {
    if (selectedPatient) {
      loadCustomDefinitions();
    } else {
      setCustomDefinitions([]);
      setCustomVitalsData({});
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (selectedPatient && isHistoryView) {
      loadVitalsHistory();
    }
  }, [selectedPatient, isHistoryView]);

  useEffect(() => {
    if (isHistoryView && selectedPatient) {
      loadVitalsHistory();
    }
  }, [filterType, filterDateFrom, filterDateTo, searchTerm]);

  const loadCustomDefinitions = async () => {
    if (!selectedPatient) return;
    try {
      const response = await fetch(
        `${config.apiUrl}/api/vitals/custom-definitions?patient_id=${selectedPatient.id}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const defs = await response.json();
        setCustomDefinitions(defs);
      }
    } catch (err) {
      console.error('Error loading custom vital definitions:', err);
    }
  };

  const handleAddCustomDefinition = async () => {
    if (!newCustomName.trim()) return;
    setCustomDefError(null);
    try {
      const response = await fetch(`${config.apiUrl}/api/vitals/custom-definitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          name: newCustomName.trim(),
          unit: newCustomUnit.trim() || null,
          display_label: newCustomName.trim(),
        })
      });
      if (response.ok) {
        const def = await response.json();
        setCustomDefinitions(prev => [...prev, def]);
        setActiveVitals(prev => ({ ...prev, [def.name]: true }));
        setNewCustomName('');
        setNewCustomUnit('');
      } else {
        const err = await response.json();
        setCustomDefError(err.detail || 'Failed to create');
      }
    } catch (err) {
      setCustomDefError(err.message);
    }
  };

  const handleDeleteCustomDefinition = async (defId) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/vitals/custom-definitions/${defId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        setCustomDefinitions(prev => {
          const removed = prev.find(d => d.id === defId);
          if (removed) {
            setActiveVitals(a => { const next = { ...a }; delete next[removed.name]; return next; });
            setCustomVitalsData(d => { const next = { ...d }; delete next[removed.name]; return next; });
          }
          return prev.filter(d => d.id !== defId);
        });
      }
    } catch (err) {
      console.error('Error deleting custom vital definition:', err);
    }
  };

  const loadVitalsHistory = async () => {
    if (!selectedPatient) return;
    setLoadingHistory(true);
    try {
      let url = `${config.apiUrl}/api/vitals/patient/${selectedPatient.id}?limit=100`;
      if (filterType) url += `&vital_type=${filterType}`;
      if (filterDateFrom) url += `&start_date=${filterDateFrom}`;
      if (filterDateTo) url += `&end_date=${filterDateTo}`;

      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        let data = await response.json();
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          data = data.filter(v =>
            getVitalTypeLabel(v.vital_type).toLowerCase().includes(term) ||
            (v.notes && v.notes.toLowerCase().includes(term))
          );
        }
        setVitalsHistory(data);
      }
    } catch (err) {
      console.error('Error loading vitals history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getVitalTypeLabel = (type) => {
    const vitalType = allVitalTypes.find(v => v.value === type);
    return vitalType ? vitalType.label : type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  const getVitalTypeUnit = (type) => {
    const vitalType = allVitalTypes.find(v => v.value === type);
    return vitalType?.unit || '';
  };

  const formatVitalValue = (vital) => {
    if (vital.vital_type === 'blood_pressure') {
      if (vital.systolic && vital.diastolic) return `${vital.systolic}/${vital.diastolic}`;
      if (typeof vital.value === 'object' && vital.value) {
        return `${vital.value.systolic || '-'}/${vital.value.diastolic || '-'}`;
      }
    }
    return vital.value || '-';
  };

  const handleVitalsSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) { setError('Please select a patient first'); return; }

    const hasBuiltInVital = vitalsFormData.heart_rate || vitalsFormData.spo2 ||
                     vitalsFormData.respiratory_rate || vitalsFormData.temperature ||
                     vitalsFormData.weight || (vitalsFormData.systolic && vitalsFormData.diastolic);
    const hasCustomVital = Object.values(customVitalsData).some(v => v !== '' && v != null);
    const hasNotes = vitalsFormData.notes?.trim();

    if (!hasBuiltInVital && !hasCustomVital && !hasNotes) {
      setError('Please enter at least one vital or notes');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const promises = [];
      const basePayload = {
        patient_id: selectedPatient.id,
        datetime: vitalsFormData.timestamp,
        notes: vitalsFormData.notes
      };

      if (vitalsFormData.systolic && vitalsFormData.diastolic) {
        const systolic = parseFloat(vitalsFormData.systolic);
        const diastolic = parseFloat(vitalsFormData.diastolic);
        const calculatedMap = Math.round(diastolic + (systolic - diastolic) / 3);
        promises.push(fetch(`${config.apiUrl}/api/vitals/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...basePayload,
            vital_type: 'blood_pressure',
            value: { systolic, diastolic, map: calculatedMap }
          })
        }));
      }

      if (vitalsFormData.heart_rate) {
        promises.push(fetch(`${config.apiUrl}/api/vitals/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...basePayload,
            vital_type: 'heart_rate',
            value: parseFloat(vitalsFormData.heart_rate)
          })
        }));
      }

      if (vitalsFormData.spo2) {
        promises.push(fetch(`${config.apiUrl}/api/vitals/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...basePayload,
            vital_type: 'spo2',
            value: parseFloat(vitalsFormData.spo2)
          })
        }));
      }

      if (vitalsFormData.respiratory_rate) {
        promises.push(fetch(`${config.apiUrl}/api/vitals/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...basePayload,
            vital_type: 'respiratory_rate',
            value: parseFloat(vitalsFormData.respiratory_rate)
          })
        }));
      }

      if (vitalsFormData.temperature) {
        promises.push(fetch(`${config.apiUrl}/api/vitals/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...basePayload,
            vital_type: 'temperature',
            value: parseFloat(vitalsFormData.temperature)
          })
        }));
      }

      if (vitalsFormData.weight) {
        promises.push(fetch(`${config.apiUrl}/api/vitals/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...basePayload,
            vital_type: 'weight',
            value: parseFloat(vitalsFormData.weight)
          })
        }));
      }

      // Custom vitals
      for (const def of customDefinitions) {
        const val = customVitalsData[def.name];
        if (val !== undefined && val !== '' && val != null) {
          promises.push(fetch(`${config.apiUrl}/api/vitals/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              ...basePayload,
              vital_type: def.name,
              value: parseFloat(val)
            })
          }));
        }
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);
        const allOk = results.every(r => r.ok);

        if (allOk) {
          const count = promises.length;
          setSuccess(`${count} vital${count > 1 ? 's' : ''} recorded successfully!`);
          setVitalsFormData({
            heart_rate: '', spo2: '', respiratory_rate: '', temperature: '', weight: '',
            systolic: '', diastolic: '', notes: '',
            timestamp: getLocalDateTimeString()
          });
          setCustomVitalsData({});
          setTimeout(() => setSuccess(null), 3000);
        } else {
          throw new Error('Some vitals failed to save');
        }
      } else if (hasNotes) {
        setSuccess('Notes saved!');
        setVitalsFormData(prev => ({ ...prev, notes: '' }));
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchTerm('');
  };

  const renderRecordView = () => (
    <div className="admin-v2-vitals-content">
      <div className="admin-v2-settings-card">
        <form onSubmit={handleVitalsSubmit}>
          {/* Date/Time Header */}
          <div className="vitals-form-header">
            <div className="vitals-datetime-field">
              <label>Date/Time</label>
              <input
                type="datetime-local"
                value={vitalsFormData.timestamp}
                onChange={(e) => setVitalsFormData(prev => ({ ...prev, timestamp: e.target.value }))}
                className="admin-v2-input"
                required
              />
            </div>
          </div>

          {/* Vital Toggle Buttons */}
          <div className="vitals-toggle-bar">
            {builtInVitalTypes.map(vt => (
              <button
                key={vt.value}
                type="button"
                className={`vitals-toggle-btn ${activeVitals[vt.value] ? 'active' : ''}`}
                onClick={() => toggleVital(vt.value)}
              >
                {vt.label}
              </button>
            ))}
            {customDefinitions.map(def => (
              <button
                key={def.name}
                type="button"
                className={`vitals-toggle-btn custom ${activeVitals[def.name] ? 'active' : ''}`}
                onClick={() => toggleVital(def.name)}
              >
                {def.display_label}
              </button>
            ))}
            <button
              type="button"
              className="vitals-toggle-btn manage-custom"
              onClick={() => setShowCustomManager(!showCustomManager)}
              title="Manage custom vitals"
            >
              +
            </button>
          </div>

          {/* Custom Vital Definition Manager */}
          {showCustomManager && (
            <div className="custom-vitals-manager">
              <div className="custom-vitals-manager-header">
                <span>Custom Vitals</span>
              </div>
              <div className="custom-vitals-add-row">
                <input
                  type="text"
                  value={newCustomName}
                  onChange={(e) => setNewCustomName(e.target.value)}
                  placeholder="Name (e.g. Blood Glucose)"
                  className="admin-v2-input"
                />
                <input
                  type="text"
                  value={newCustomUnit}
                  onChange={(e) => setNewCustomUnit(e.target.value)}
                  placeholder="Unit (e.g. mg/dL)"
                  className="admin-v2-input"
                  style={{ maxWidth: 120 }}
                />
                <button
                  type="button"
                  className="admin-v2-btn admin-v2-btn-primary"
                  onClick={handleAddCustomDefinition}
                  disabled={!newCustomName.trim()}
                >
                  Add
                </button>
              </div>
              {customDefError && (
                <div className="custom-vitals-error">{customDefError}</div>
              )}
              {customDefinitions.length > 0 && (
                <div className="custom-vitals-list">
                  {customDefinitions.map(def => (
                    <div key={def.id} className="custom-vital-item">
                      <span className="custom-vital-name">{def.display_label}</span>
                      {def.unit && <span className="custom-vital-unit">{def.unit}</span>}
                      <button
                        type="button"
                        className="custom-vital-delete"
                        onClick={() => handleDeleteCustomDefinition(def.id)}
                        title="Remove custom vital"
                      >
                        <XIcon size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vital Input Cards */}
          <div className="vitals-input-grid">
            {/* Blood Pressure */}
            {activeVitals.blood_pressure && (
              <div className="vital-input-card">
                <div className="vital-input-header">
                  <span className="vital-input-title">Blood Pressure</span>
                </div>
                <div className="vital-input-fields bp-fields">
                  <div className="vital-input-group">
                    <input
                      type="number"
                      value={vitalsFormData.systolic}
                      onChange={(e) => setVitalsFormData(prev => ({ ...prev, systolic: e.target.value }))}
                      className="vital-input"
                      placeholder="120"
                      min="60"
                      max="250"
                    />
                    <span className="vital-input-label">Systolic</span>
                  </div>
                  <span className="bp-separator">/</span>
                  <div className="vital-input-group">
                    <input
                      type="number"
                      value={vitalsFormData.diastolic}
                      onChange={(e) => setVitalsFormData(prev => ({ ...prev, diastolic: e.target.value }))}
                      className="vital-input"
                      placeholder="80"
                      min="40"
                      max="150"
                    />
                    <span className="vital-input-label">Diastolic</span>
                  </div>
                  <span className="vital-unit">mmHg</span>
                </div>
              </div>
            )}

            {/* Heart Rate */}
            {activeVitals.heart_rate && (
              <div className="vital-input-card">
                <div className="vital-input-header">
                  <span className="vital-input-title">Heart Rate</span>
                </div>
                <div className="vital-input-fields single-field">
                  <input
                    type="number"
                    value={vitalsFormData.heart_rate}
                    onChange={(e) => setVitalsFormData(prev => ({ ...prev, heart_rate: e.target.value }))}
                    className="vital-input large"
                    placeholder="72"
                    min="30"
                    max="250"
                  />
                  <span className="vital-unit">bpm</span>
                </div>
              </div>
            )}

            {/* SpO2 */}
            {activeVitals.spo2 && (
              <div className="vital-input-card">
                <div className="vital-input-header">
                  <span className="vital-input-title">SpO2</span>
                </div>
                <div className="vital-input-fields single-field">
                  <input
                    type="number"
                    value={vitalsFormData.spo2}
                    onChange={(e) => setVitalsFormData(prev => ({ ...prev, spo2: e.target.value }))}
                    className="vital-input large"
                    placeholder="98"
                    min="50"
                    max="100"
                  />
                  <span className="vital-unit">%</span>
                </div>
              </div>
            )}

            {/* Respiratory Rate */}
            {activeVitals.respiratory_rate && (
              <div className="vital-input-card">
                <div className="vital-input-header">
                  <span className="vital-input-title">Respiratory Rate</span>
                </div>
                <div className="vital-input-fields single-field">
                  <input
                    type="number"
                    value={vitalsFormData.respiratory_rate}
                    onChange={(e) => setVitalsFormData(prev => ({ ...prev, respiratory_rate: e.target.value }))}
                    className="vital-input large"
                    placeholder="16"
                    min="5"
                    max="60"
                  />
                  <span className="vital-unit">/min</span>
                </div>
              </div>
            )}

            {/* Temperature */}
            {activeVitals.temperature && (
              <div className="vital-input-card">
                <div className="vital-input-header">
                  <span className="vital-input-title">Temperature</span>
                </div>
                <div className="vital-input-fields single-field">
                  <input
                    type="number"
                    step="0.1"
                    value={vitalsFormData.temperature}
                    onChange={(e) => setVitalsFormData(prev => ({ ...prev, temperature: e.target.value }))}
                    className="vital-input large"
                    placeholder="98.6"
                    min="90"
                    max="110"
                  />
                  <span className="vital-unit">°F</span>
                </div>
              </div>
            )}

            {/* Weight */}
            {activeVitals.weight && (
              <div className="vital-input-card">
                <div className="vital-input-header">
                  <span className="vital-input-title">Weight</span>
                </div>
                <div className="vital-input-fields single-field">
                  <input
                    type="number"
                    step="0.1"
                    value={vitalsFormData.weight}
                    onChange={(e) => setVitalsFormData(prev => ({ ...prev, weight: e.target.value }))}
                    className="vital-input large"
                    placeholder="150"
                    min="1"
                    max="1000"
                  />
                  <span className="vital-unit">lbs</span>
                </div>
              </div>
            )}

            {/* Custom Vital Input Cards */}
            {customDefinitions.filter(def => activeVitals[def.name]).map(def => (
              <div className="vital-input-card" key={def.name}>
                <div className="vital-input-header">
                  <span className="vital-input-title">{def.display_label}</span>
                </div>
                <div className="vital-input-fields single-field">
                  <input
                    type="number"
                    step="any"
                    value={customVitalsData[def.name] || ''}
                    onChange={(e) => setCustomVitalsData(prev => ({ ...prev, [def.name]: e.target.value }))}
                    className="vital-input large"
                    placeholder="—"
                  />
                  {def.unit && <span className="vital-unit">{def.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="vitals-notes-section">
            <label>Notes (optional)</label>
            <textarea
              value={vitalsFormData.notes}
              onChange={(e) => setVitalsFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="admin-v2-input"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>

          {/* Submit */}
          <div className="vitals-form-actions">
            <button type="submit" disabled={saving || !selectedPatient} className="admin-v2-btn admin-v2-btn-primary vitals-submit-btn">
              {saving ? 'Saving...' : 'Record Vitals'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderHistoryView = () => (
    <div className="admin-v2-vitals-content">
      <div className="vitals-history-filters">
        <div className="vitals-filter-row">
          <div className="vitals-filter-group search">
            <label>Search</label>
            <div className="vitals-search-wrapper">
              <SearchIcon size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vitals..."
              />
            </div>
          </div>
          <div className="vitals-filter-group">
            <label>Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {allVitalTypes.map(vt => (<option key={vt.value} value={vt.value}>{vt.label}</option>))}
            </select>
          </div>
          <div className="vitals-filter-group">
            <label>From</label>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="vitals-filter-group">
            <label>To</label>
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
          </div>
          <div className="vitals-filter-group actions">
            <button className="vitals-clear-btn" onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
      <div className="admin-v2-table-container">
        {loadingHistory ? (
          <div className="admin-v2-loading">Loading history...</div>
        ) : vitalsHistory.length === 0 ? (
          <div className="admin-v2-empty-state"><p>No vitals found</p></div>
        ) : (
          <table className="admin-v2-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Type</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Notes</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {vitalsHistory.map((vital, idx) => (
                <tr key={vital.id || idx}>
                  <td>{vital.timestamp ? new Date(vital.timestamp).toLocaleString() : '-'}</td>
                  <td>{getVitalTypeLabel(vital.vital_type)}</td>
                  <td className="admin-v2-vital-value">{formatVitalValue(vital)}</td>
                  <td>{getVitalTypeUnit(vital.vital_type)}</td>
                  <td className="admin-v2-table-description">{vital.notes || '-'}</td>
                  <td><span className={`admin-v2-source-badge ${vital.source || 'manual'}`}>{vital.source || 'Manual'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <AdminV2Layout>
      <div className="admin-v2-page">
        {error && (
          <div className="admin-v2-alert admin-v2-alert-error">
            {error}
            <button onClick={() => setError(null)} className="admin-v2-alert-close"><XIcon size={16} /></button>
          </div>
        )}
        {success && <div className="admin-v2-alert admin-v2-alert-success">{success}</div>}
        {!selectedPatient ? (
          <div className="admin-v2-empty-state"><p>Please select a patient from the sidebar</p></div>
        ) : (
          isHistoryView ? renderHistoryView() : renderRecordView()
        )}
      </div>
    </AdminV2Layout>
  );
};

export default AdminV2Vitals;
