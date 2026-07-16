import React, { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'

const API_BASE = 'http://localhost:8000'
const STORES = ['Store_1', 'Store_2', 'Store_3', 'Store_4', 'Store_5']
const PRODUCTS = ['Product_A', 'Product_B', 'Product_C', 'Product_D', 'Product_E', 'Product_F', 'Product_G', 'Product_H']

function todayPlus(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#162135', border: '1px solid #223052', borderRadius: 6,
      padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12,
    }}>
      <div style={{ color: '#8793AC', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#21C7A8' }}>{payload[0].value} units</div>
    </div>
  )
}

export default function App() {
  const [online, setOnline] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [metricsSource, setMetricsSource] = useState('')

  const [store, setStore] = useState(STORES[0])
  const [product, setProduct] = useState(PRODUCTS[0])
  const [targetDate, setTargetDate] = useState(todayPlus(1))
  const [promo, setPromo] = useState(false)

  const [prediction, setPrediction] = useState(null)
  const [forecast, setForecast] = useState([])
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/`)
      const data = await res.json()
      setOnline(true)
      return data
    } catch {
      setOnline(false)
      return null
    }
  }, [])

  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/evaluate`)
      if (!res.ok) return
      const data = await res.json()
      const m = Array.isArray(data.metrics)
        ? data.metrics.find(r => String(r.model || '').includes('XGBoost')) || data.metrics[data.metrics.length - 1]
        : data.metrics
      setMetrics(m)
      setMetricsSource(data.source || '')
    } catch { /* API offline, ignore */ }
  }, [])

  useEffect(() => {
    checkHealth()
    loadMetrics()
    const interval = setInterval(checkHealth, 8000)
    return () => clearInterval(interval)
  }, [checkHealth, loadMetrics])

  async function fetchPrediction(store, product, date, promoFlag) {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, product, date, promo: promoFlag ? 1 : 0 }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Request failed (${res.status})`)
    }
    return res.json()
  }

  async function handlePredict(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await fetchPrediction(store, product, targetDate, promo)
      setPrediction(result)
      setLog(prev => [{ ...result, promo, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 8))

      // Build a 10-day forecast horizon around the target date for the chart
      const base = new Date(targetDate)
      const points = []
      for (let i = -3; i <= 6; i++) {
        const d = new Date(base)
        d.setDate(d.getDate() + i)
        const iso = d.toISOString().slice(0, 10)
        try {
          const r = await fetchPrediction(store, product, iso, promo)
          points.push({ date: iso.slice(5), units: r.predicted_units_sold, isTarget: iso === targetDate })
        } catch { /* skip failed point */ }
      }
      setForecast(points)
    } catch (err) {
      setError(err.message)
      setPrediction(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('Uploading…')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload failed')
      setUploadStatus(`${data.filename} — ${data.rows.toLocaleString()} rows`)
    } catch (err) {
      setUploadStatus(`Failed: ${err.message}`)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">Forecasting Engine · XGBoost</p>
          <h1>Demand Console</h1>
        </div>
        <div className="status">
          <span className={`status-dot ${online ? 'online' : ''}`} />
          {online ? 'API connected — localhost:8000' : 'API offline — start the FastAPI server'}
        </div>
      </header>

      <div className="grid">
        {/* ---- Control panel ---- */}
        <div className="panel">
          <p className="panel-title">Query</p>
          <form onSubmit={handlePredict}>
            <div className="field">
              <label htmlFor="store">Store</label>
              <select id="store" value={store} onChange={e => setStore(e.target.value)}>
                {STORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="product">Product</label>
              <select id="product" value={product} onChange={e => setProduct(e.target.value)}>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="date">Target date</label>
              <input id="date" type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
            </div>
            <div className="checkbox-row">
              <input id="promo" type="checkbox" checked={promo} onChange={e => setPromo(e.target.checked)} />
              <label htmlFor="promo">Promotion running that day</label>
            </div>
            <button className="primary" type="submit" disabled={loading || !online}>
              {loading ? 'Forecasting…' : 'Run forecast'}
            </button>
            {error && <p className="error-msg">{error}</p>}
          </form>

          <div className="upload-row">
            <label htmlFor="csv-upload">
              {uploadStatus || 'Upload a dataset CSV'}
              <input id="csv-upload" type="file" accept=".csv" onChange={handleUpload} />
            </label>
          </div>
        </div>

        {/* ---- Main content ---- */}
        <div>
          <div className="metrics-row">
            <div className="metric-card">
              <p className="metric-label">MAE</p>
              <p className="metric-value">{metrics ? metrics.MAE : '—'}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">RMSE</p>
              <p className="metric-value">{metrics ? metrics.RMSE : '—'}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">R²</p>
              <p className="metric-value accent">{metrics ? metrics.R2 : '—'}</p>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <p className="panel-title">Prediction</p>
            {prediction ? (
              <div className="readout">
                <span className="readout-value">{prediction.predicted_units_sold}</span>
                <span className="readout-unit">units sold</span>
                <span className="readout-sub">
                  {prediction.store} · {prediction.product} · {prediction.date}
                  {promo ? ' · promo active' : ''}
                </span>
              </div>
            ) : (
              <p className="empty-state">Run a forecast to see the prediction here.</p>
            )}
          </div>

          <div className="chart-wrap">
            <p className="panel-title">10-day window around target date</p>
            {forecast.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={forecast} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#223052" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#8793AC" fontSize={11} tickLine={false} axisLine={{ stroke: '#223052' }} />
                  <YAxis stroke="#8793AC" fontSize={11} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone" dataKey="units" stroke="#21C7A8" strokeWidth={2}
                    dot={{ r: 3, fill: '#21C7A8', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="empty-state">Run a forecast to plot the surrounding 10-day window.</p>
            )}
          </div>

          <div className="panel">
            <p className="panel-title">Recent queries</p>
            {log.length > 0 ? (
              <table className="log-table">
                <thead>
                  <tr>
                    <th>Time</th><th>Store</th><th>Product</th><th>Date</th><th>Promo</th><th>Predicted</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((row, i) => (
                    <tr key={i}>
                      <td>{row.ts}</td>
                      <td>{row.store}</td>
                      <td>{row.product}</td>
                      <td>{row.date}</td>
                      <td>{row.promo ? <span className="tag">PROMO</span> : '—'}</td>
                      <td>{row.predicted_units_sold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">No queries yet this session.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
