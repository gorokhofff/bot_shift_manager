import React, { useState, useEffect } from 'react';
import API from '../api';

const ROLES = ['кальянщик', 'старший кальянщик', 'администратор', 'уборщик', 'студент', 'бармен/зал'];
const PERIOD_TYPES = [
  { value: '1-15', label: '1-15 число' },
  { value: '16-end', label: '16-последний день' },
  { value: 'per_hookah', label: 'За кальян' }
];

function RatesManager() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  
  const [formData, setFormData] = useState({
    role: '',
    rate: '',
    period_type: '1-15',
    effective_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    try {
      setLoading(true);
      const response = await API.get('/rates');
      setRates(response.data || []);
    } catch (error) { alert('Failed to load rates'); } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.role || !formData.rate || !formData.effective_date) return alert('Fill all fields');

    try {
      if (editingRate) {
        await API.put(`/rates/${editingRate.id}`, { rate: parseFloat(formData.rate), effective_date: formData.effective_date });
      } else {
        await API.post('/rates', { ...formData, rate: parseFloat(formData.rate) });
      }
      setFormData({ role: '', rate: '', period_type: '1-15', effective_date: new Date().toISOString().split('T')[0] });
      setShowCreateForm(false);
      setEditingRate(null);
      await loadRates();
    } catch (error) { alert(`Error: ${error.message}`); }
  };

  const groupedRates = rates.reduce((acc, rate) => {
    if (!acc[rate.role]) acc[rate.role] = [];
    acc[rate.role].push(rate);
    return acc;
  }, {});

  const getCurrentRate = (role, periodType) => {
    const roleRates = groupedRates[role] || [];
    const currentDate = new Date().toISOString().split('T')[0];
    const validRates = roleRates.filter(rate => rate.period_type === periodType && rate.effective_date <= currentDate);
    validRates.sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
    return validRates[0] || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">Rate Management</h1>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-primary">
          {showCreateForm ? 'Cancel' : 'Add New Rate'}
        </button>
      </div>

      {showCreateForm && (
        <div className="card-surface p-6 max-w-2xl mx-auto border border-blue-600/50">
          <h2 className="text-xl font-bold mb-6">{editingRate ? `Edit Rate #${editingRate.id}` : 'New Rate Definition'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Role</label>
                <select 
                  className="table-input" 
                  value={formData.role} 
                  onChange={e => setFormData({...formData, role: e.target.value})}
                  disabled={editingRate}
                >
                  <option value="">Select Role</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Period Type</label>
                 <select 
                    className="table-input" 
                    value={formData.period_type} 
                    onChange={e => setFormData({...formData, period_type: e.target.value})}
                    disabled={editingRate}
                 >
                    {PERIOD_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                 </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rate Value (TL)</label>
                  <input type="number" step="0.01" className="table-input" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Effective Date</label>
                  <input type="date" className="table-input" value={formData.effective_date} onChange={e => setFormData({...formData, effective_date: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end pt-4">
               <button type="submit" className="h-11 px-6 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors">
                  {editingRate ? 'Update Rate' : 'Create Rate'}
               </button>
            </div>
          </form>
        </div>
      )}

      {/* Current Rates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         {ROLES.map(role => (
             <div key={role} className="card-surface p-5 hover:border-gray-500 transition-colors">
                 <h3 className="text-lg font-bold text-white mb-4 border-b border-gray-700 pb-2">{role}</h3>
                 <div className="space-y-3">
                    {['1-15', '16-end', 'per_hookah'].map(pt => {
                        const rate = getCurrentRate(role, pt);
                        if (!rate) return null;
                        return (
                            <div key={pt} className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg">
                                <span className="text-xs text-gray-400 font-medium uppercase">{PERIOD_TYPES.find(p => p.value === pt)?.label}</span>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-green-400">{rate.rate} TL</div>
                                    <div className="text-[10px] text-gray-500">since {rate.effective_date}</div>
                                </div>
                            </div>
                        );
                    })}
                    {!['1-15', '16-end', 'per_hookah'].some(pt => getCurrentRate(role, pt)) && (
                        <div className="text-gray-500 text-sm italic">No active rates configured</div>
                    )}
                 </div>
             </div>
         ))}
      </div>
    </div>
  );
}

export default RatesManager;