import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminPatient } from '../../contexts/AdminPatientContext';
import { API_BASE_URL } from '../../config';
import AdminV2Layout from './AdminV2Layout';
import {
  PlusIcon,
  RefreshIcon,
  XIcon,
  CheckIcon,
  ClockIcon,
  LinkIcon
} from '../../components/Icons';
import './AdminV2.css';

export default function AdminV2Integrations() {
  const { user } = useAuth();
  const { selectedPatient, loadingPatients } = useAdminPatient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Available integrations from registry
  const [availableIntegrations, setAvailableIntegrations] = useState([]);
  
  // Patient's configured integrations
  const [patientIntegrations, setPatientIntegrations] = useState([]);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [addingIntegration, setAddingIntegration] = useState(false);
  
  // Settings for new integration
  const [newSettings, setNewSettings] = useState({});
  
  // Syncing state
  const [syncingId, setSyncingId] = useState(null);

  // Get patient ID
  const patientId = selectedPatient?.id;

  useEffect(() => {
    if (patientId) {
      fetchIntegrations();
    }
  }, [patientId]);

  const fetchIntegrations = async () => {
    if (!patientId) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Fetch available integrations
      const availableRes = await fetch(`${API_BASE_URL}/api/integrations`, {
        credentials: 'include'
      });
      if (!availableRes.ok) throw new Error('Failed to fetch available integrations');
      const available = await availableRes.json();
      setAvailableIntegrations(available);

      // Fetch patient's configured integrations
      const patientRes = await fetch(
        `${API_BASE_URL}/api/integrations/patient/${patientId}?include_disabled=true`,
        { credentials: 'include' }
      );
      if (!patientRes.ok) throw new Error('Failed to fetch patient integrations');
      const patient = await patientRes.json();
      setPatientIntegrations(patient);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIntegration = async () => {
    if (!selectedIntegration) return;
    
    setAddingIntegration(true);
    setError('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations/patient/${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          integration_slug: selectedIntegration.slug,
          settings: newSettings
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to add integration');
      }

      const newIntegration = await res.json();
      
      // If OAuth integration, start OAuth flow
      if (selectedIntegration.auth_type === 'oauth2') {
        await startOAuthFlow(newIntegration.id);
      } else {
        setSuccess(`${selectedIntegration.name} integration added successfully`);
        await fetchIntegrations();
      }
      
      setShowAddModal(false);
      setSelectedIntegration(null);
      setNewSettings({});
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingIntegration(false);
    }
  };

  const startOAuthFlow = async (integrationId) => {
    try {
      const redirectUrl = `${window.location.origin}/care/integrations`;
      const res = await fetch(
        `${API_BASE_URL}/api/integrations/patient/${patientId}/${integrationId}/oauth/start?redirect_url=${encodeURIComponent(redirectUrl)}`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to start OAuth flow');
      }

      const data = await res.json();
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSync = async (integration) => {
    setError('');
    setSuccess('');
    setSyncingId(integration.id);
    
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/integrations/patient/${patientId}/${integration.id}/sync`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Sync failed');
      }

      const result = await res.json();
      if (result.success) {
        setSuccess(`Synced ${result.readings_count} readings from ${integration.integration_name}`);
      } else {
        setError(result.error_message || 'Sync failed');
      }
      
      await fetchIntegrations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggle = async (integration, enabled) => {
    try {
      if (enabled) {
        const res = await fetch(
          `${API_BASE_URL}/api/integrations/patient/${patientId}/${integration.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(integration.settings || {})
          }
        );
        if (!res.ok) throw new Error('Failed to update integration');
      } else {
        const res = await fetch(
          `${API_BASE_URL}/api/integrations/patient/${patientId}/${integration.id}`,
          {
            method: 'DELETE',
            credentials: 'include'
          }
        );
        if (!res.ok) throw new Error('Failed to disable integration');
      }
      
      await fetchIntegrations();
    } catch (err) {
      setError(err.message);
    }
  };

  const getAuthTypeLabel = (authType) => {
    switch (authType) {
      case 'oauth2': return 'OAuth 2.0';
      case 'api_key': return 'API Key';
      case 'local': return 'Local';
      case 'none': return 'No Auth';
      default: return authType;
    }
  };

  const getStatusBadge = (integration) => {
    if (!integration.is_enabled) {
      return <span className="admin-v2-badge admin-v2-badge-muted">Disabled</span>;
    }
    if (integration.last_sync_status === 'failed') {
      return <span className="admin-v2-badge admin-v2-badge-danger">Error</span>;
    }
    if (integration.last_sync_at) {
      return <span className="admin-v2-badge admin-v2-badge-success">Connected</span>;
    }
    return <span className="admin-v2-badge admin-v2-badge-warning">Pending Setup</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  // Check URL params for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setSuccess('Integration connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      setError(`OAuth error: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Get integrations not yet configured for this patient
  const unconfiguredIntegrations = availableIntegrations.filter(
    avail => !patientIntegrations.some(pi => pi.integration_slug === avail.slug)
  );

  // Stats
  const stats = {
    total: patientIntegrations.length,
    connected: patientIntegrations.filter(i => i.is_enabled && i.last_sync_at).length,
    pending: patientIntegrations.filter(i => i.is_enabled && !i.last_sync_at).length,
    available: availableIntegrations.length
  };

  // Loading state
  if (loadingPatients) {
    return (
      <AdminV2Layout>
        <div className="admin-v2-loading">Loading patients...</div>
      </AdminV2Layout>
    );
  }

  if (!selectedPatient) {
    return (
      <AdminV2Layout>
        <div className="admin-v2-empty-state">
          <LinkIcon size={48} />
          <h3>Select a Patient</h3>
          <p className="admin-v2-text-muted">Please select a patient to manage integrations.</p>
        </div>
      </AdminV2Layout>
    );
  }

  return (
    <AdminV2Layout>
      <div className="admin-v2-page">
        {/* Section Title */}
        <h1 className="schedule-section-title">Integrations</h1>
        <p className="admin-v2-text-muted" style={{ marginTop: '-0.5rem', marginBottom: '1.5rem' }}>
          Connect smart devices and health services for {selectedPatient.name}
        </p>

        {/* Alerts */}
        {error && (
          <div className="admin-v2-alert admin-v2-alert-danger">
            <span>{error}</span>
            <button className="admin-v2-alert-close" onClick={() => setError('')}>
              <XIcon size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="admin-v2-alert admin-v2-alert-success">
            <span>{success}</span>
            <button className="admin-v2-alert-close" onClick={() => setSuccess('')}>
              <XIcon size={16} />
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="admin-v2-stats-row">
          <div className="admin-v2-stat-card">
            <div className="admin-v2-stat-icon" style={{ background: 'rgba(88, 166, 255, 0.15)' }}>
              <LinkIcon size={20} />
            </div>
            <div className="admin-v2-stat-info">
              <h4>{stats.total}</h4>
              <p>Configured</p>
            </div>
          </div>
          <div className="admin-v2-stat-card">
            <div className="admin-v2-stat-icon" style={{ background: 'rgba(63, 185, 80, 0.15)' }}>
              <CheckIcon size={20} />
            </div>
            <div className="admin-v2-stat-info">
              <h4>{stats.connected}</h4>
              <p>Connected</p>
            </div>
          </div>
          <div className="admin-v2-stat-card">
            <div className="admin-v2-stat-icon" style={{ background: 'rgba(210, 153, 34, 0.15)' }}>
              <ClockIcon size={20} />
            </div>
            <div className="admin-v2-stat-info">
              <h4>{stats.pending}</h4>
              <p>Pending</p>
            </div>
          </div>
          <div className="admin-v2-stat-card">
            <div className="admin-v2-stat-icon" style={{ background: 'rgba(163, 113, 247, 0.15)' }}>
              <PlusIcon size={20} />
            </div>
            <div className="admin-v2-stat-info">
              <h4>{stats.available}</h4>
              <p>Available</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="admin-v2-loading">Loading integrations...</div>
        ) : (
          <>
            {/* Configured Integrations */}
            <div className="admin-v2-page-header">
              <h3 style={{ margin: 0, color: '#e6edf3' }}>
                Connected Integrations ({patientIntegrations.length})
              </h3>
              {unconfiguredIntegrations.length > 0 && (
                <button 
                  className="admin-v2-btn admin-v2-btn-primary"
                  onClick={() => setShowAddModal(true)}
                >
                  <PlusIcon size={16} /> Add Integration
                </button>
              )}
            </div>

            {patientIntegrations.length === 0 ? (
              <div className="admin-v2-empty-state">
                <LinkIcon size={48} />
                <h3>No Integrations Configured</h3>
                <p className="admin-v2-text-muted">Connect your first integration to start syncing health data.</p>
                <button 
                  className="admin-v2-btn admin-v2-btn-primary"
                  onClick={() => setShowAddModal(true)}
                >
                  <PlusIcon size={16} /> Add Your First Integration
                </button>
              </div>
            ) : (
              <div className="admin-v2-table-container">
                <table className="admin-v2-table">
                  <thead>
                    <tr>
                      <th>Integration</th>
                      <th>Status</th>
                      <th>Last Sync</th>
                      <th>Syncs</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientIntegrations.map(integration => (
                      <tr key={integration.id} className={!integration.is_enabled ? 'admin-v2-row-disabled' : ''}>
                        <td>
                          <span className="admin-v2-integration-name">{integration.integration_name}</span>
                          <div className="admin-v2-text-muted admin-v2-text-small">{integration.integration_slug}</div>
                        </td>
                        <td>{getStatusBadge(integration)}</td>
                        <td>
                          <span>{formatDate(integration.last_sync_at)}</span>
                          {integration.last_sync_error && (
                            <div className="admin-v2-text-danger admin-v2-text-small">{integration.last_sync_error}</div>
                          )}
                        </td>
                        <td>{integration.sync_count || 0}</td>
                        <td>
                          <div className="admin-v2-table-actions">
                            {integration.is_enabled && (
                              <button 
                                className="admin-v2-btn admin-v2-btn-sm admin-v2-btn-ghost"
                                onClick={() => handleSync(integration)}
                                disabled={syncingId === integration.id}
                                title="Sync Now"
                              >
                                <RefreshIcon size={14} className={syncingId === integration.id ? 'spinning' : ''} />
                                {syncingId === integration.id ? 'Syncing...' : 'Sync'}
                              </button>
                            )}
                            <button
                              className={`admin-v2-btn admin-v2-btn-sm ${integration.is_enabled ? 'admin-v2-btn-danger-ghost' : 'admin-v2-btn-success-ghost'}`}
                              onClick={() => handleToggle(integration, !integration.is_enabled)}
                            >
                              {integration.is_enabled ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Available Integrations */}
            <div className="admin-v2-page-header" style={{ marginTop: '2rem' }}>
              <h3 style={{ margin: 0, color: '#e6edf3' }}>
                Available Integrations ({availableIntegrations.length})
              </h3>
            </div>

            <div className="admin-v2-cards-grid">
              {availableIntegrations.map(integration => {
                const isConfigured = patientIntegrations.some(pi => pi.integration_slug === integration.slug);
                return (
                  <div key={integration.slug} className={`admin-v2-card ${isConfigured ? 'inactive' : ''}`}>
                    <div className="admin-v2-card-header">
                      <div className="admin-v2-card-title-row">
                        <h3>{integration.name}</h3>
                        {isConfigured && (
                          <span className="admin-v2-badge admin-v2-badge-success">Configured</span>
                        )}
                      </div>
                      <span className="admin-v2-badge admin-v2-badge-info">
                        {getAuthTypeLabel(integration.auth_type)}
                      </span>
                    </div>
                    <div className="admin-v2-card-body">
                      <p className="admin-v2-text-muted">{integration.description}</p>
                      <div className="admin-v2-card-row">
                        <span className="label">Supports:</span>
                        <span className="value">
                          {integration.supported_vitals?.slice(0, 4).join(', ')}
                          {integration.supported_vitals?.length > 4 && '...'}
                        </span>
                      </div>
                    </div>
                    {!isConfigured && (
                      <div className="admin-v2-card-actions">
                        <button 
                          className="admin-v2-btn admin-v2-btn-sm admin-v2-btn-primary"
                          onClick={() => {
                            setSelectedIntegration(integration);
                            setShowAddModal(true);
                          }}
                        >
                          <PlusIcon size={14} /> Add
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Add Integration Modal */}
        {showAddModal && (
          <div className="admin-v2-modal-overlay" onClick={() => {
            setShowAddModal(false);
            setSelectedIntegration(null);
            setNewSettings({});
          }}>
            <div className="admin-v2-modal" onClick={e => e.stopPropagation()}>
              <div className="admin-v2-modal-header">
                <h2>Add Integration</h2>
                <button 
                  className="admin-v2-modal-close"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedIntegration(null);
                    setNewSettings({});
                  }}
                >
                  <XIcon size={20} />
                </button>
              </div>
              <div className="admin-v2-modal-body">
                {!selectedIntegration ? (
                  <div className="admin-v2-integration-list">
                    {unconfiguredIntegrations.map(integration => (
                      <button
                        key={integration.slug}
                        className="admin-v2-integration-option"
                        onClick={() => setSelectedIntegration(integration)}
                      >
                        <div className="admin-v2-integration-option-info">
                          <strong>{integration.name}</strong>
                          <p className="admin-v2-text-muted admin-v2-text-small">{integration.description}</p>
                        </div>
                        <span className="admin-v2-badge admin-v2-badge-secondary">
                          {getAuthTypeLabel(integration.auth_type)}
                        </span>
                      </button>
                    ))}
                    {unconfiguredIntegrations.length === 0 && (
                      <p className="admin-v2-text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
                        All available integrations have been configured.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <h3 style={{ marginBottom: '0.5rem', color: '#e6edf3' }}>{selectedIntegration.name}</h3>
                    <p className="admin-v2-text-muted">{selectedIntegration.description}</p>
                    
                    {selectedIntegration.auth_type === 'oauth2' && (
                      <div className="admin-v2-alert admin-v2-alert-info" style={{ marginTop: '1rem' }}>
                        You will be redirected to {selectedIntegration.name} to authorize access.
                      </div>
                    )}

                    {selectedIntegration.config_schema?.properties && 
                     Object.keys(selectedIntegration.config_schema.properties).length > 0 && (
                      <div style={{ marginTop: '1.5rem' }}>
                        <h4 style={{ color: '#e6edf3', marginBottom: '1rem' }}>Settings</h4>
                        {Object.entries(selectedIntegration.config_schema.properties).map(([key, schema]) => (
                          <div key={key} className="admin-v2-form-group">
                            <label className="admin-v2-label">{schema.title || key}</label>
                            {schema.type === 'boolean' ? (
                              <label className="admin-v2-checkbox">
                                <input
                                  type="checkbox"
                                  checked={newSettings[key] ?? schema.default ?? false}
                                  onChange={(e) => setNewSettings({
                                    ...newSettings,
                                    [key]: e.target.checked
                                  })}
                                />
                                <span>{schema.description}</span>
                              </label>
                            ) : (
                              <input
                                type="text"
                                className="admin-v2-input"
                                value={newSettings[key] ?? schema.default ?? ''}
                                onChange={(e) => setNewSettings({
                                  ...newSettings,
                                  [key]: e.target.value
                                })}
                                placeholder={schema.description}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="admin-v2-modal-footer">
                {selectedIntegration && (
                  <button 
                    className="admin-v2-btn admin-v2-btn-ghost"
                    onClick={() => {
                      setSelectedIntegration(null);
                      setNewSettings({});
                    }}
                  >
                    Back
                  </button>
                )}
                <button 
                  className="admin-v2-btn admin-v2-btn-secondary"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedIntegration(null);
                    setNewSettings({});
                  }}
                >
                  Cancel
                </button>
                {selectedIntegration && (
                  <button 
                    className="admin-v2-btn admin-v2-btn-primary"
                    onClick={handleAddIntegration}
                    disabled={addingIntegration}
                  >
                    {addingIntegration ? 'Adding...' : (
                      selectedIntegration.auth_type === 'oauth2' 
                        ? `Connect to ${selectedIntegration.name}`
                        : 'Add Integration'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}
