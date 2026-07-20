import React, { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, AreaChart, Area,
  BarChart, Bar, Legend, PieChart, Pie, Cell, ComposedChart,
} from 'recharts'

const API_BASE = 'https://ml-demand-forecasting-platform-production.up.railway.app'
const STORES = ['Store_1', 'Store_2', 'Store_3', 'Store_4', 'Store_5']
const PRODUCTS = ['Product_A', 'Product_B', 'Product_C', 'Product_D', 'Product_E', 'Product_F', 'Product_G', 'Product_H']

function todayPlus(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number(value))
}

function buildInsight(predictedUnits, forecast = [], promoFlag = false) {
  const average = forecast.length
    ? forecast.reduce((sum, point) => sum + point.units, 0) / forecast.length
    : predictedUnits

  const delta = predictedUnits - average
  const deltaLabel = delta >= 0
    ? `+${formatNumber(delta)} versus the recent average`
    : `${formatNumber(delta)} versus the recent average`

  if (predictedUnits >= average * 1.12) {
    return {
      title: 'Strong demand',
      tone: 'positive',
      summary: 'This looks like a healthy day for sales, so the team can plan around stronger traffic.',
      action: 'Keep stock ready and prepare extra support.',
      deltaLabel,
    }
  }

  if (predictedUnits <= average * 0.9) {
    return {
      title: 'Watch closely',
      tone: 'caution',
      summary: 'Demand appears softer than usual, so it is wise to keep inventory and staffing flexible.',
      action: 'Review stock levels and avoid overcommitting resources.',
      deltaLabel,
    }
  }

  return {
    title: 'Steady demand',
    tone: 'neutral',
    summary: 'Demand looks stable, which means business should continue as expected without major surprises.',
    action: promoFlag ? 'Use the promotion to lift sales but keep operations steady.' : 'Keep the current plan and monitor for changes.',
    deltaLabel,
  }
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#162135', border: '1px solid #223052', borderRadius: 8,
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
  const [insight, setInsight] = useState({
    title: 'Ready to see demand',
    tone: 'neutral',
    summary: 'Choose a store, product, and date to get a simple business summary.',
    action: 'Run a forecast to view a recommendation.',
    deltaLabel: 'Forecast will appear here',
  })

  // State for interactive details and comparison
  const [expandedCard, setExpandedCard] = useState(null)
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonData, setComparisonData] = useState(null)
  const [activeSection, setActiveSection] = useState(null)

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

  async function fetchPrediction(storeName, productName, date, promoFlag) {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store: storeName, product: productName, date, promo: promoFlag ? 1 : 0 }),
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
      setExpandedCard(null)

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

      // Generate comparison data (promo vs non-promo for this date)
      try {
        const promoResult = await fetchPrediction(store, product, targetDate, true)
        const noPromoResult = await fetchPrediction(store, product, targetDate, false)
        setComparisonData([
          { name: 'With Promo', value: promoResult.predicted_units_sold, fill: '#21C7A8' },
          { name: 'Without Promo', value: noPromoResult.predicted_units_sold, fill: '#5DA7FF' }
        ])
      } catch { /* comparison data optional */ }

      const nextInsight = buildInsight(result.predicted_units_sold, points, promo)
      setInsight(nextInsight)
      setForecast(points)
    } catch (err) {
      setError(err.message)
      setPrediction(null)
      setInsight({
        title: 'Needs attention',
        tone: 'caution',
        summary: 'The forecast could not be generated right now, so please try again in a moment.',
        action: 'Check the API connection and retry.',
        deltaLabel: 'No forecast available',
      })
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

  const handleExportData = () => {
    if (!prediction) return
    const data = {
      prediction: prediction.predicted_units_sold,
      store: prediction.store,
      product: prediction.product,
      date: prediction.date,
      withPromo: promo,
      insight: insight.title,
      generatedAt: new Date().toISOString(),
    }
    const dataStr = JSON.stringify(data, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `forecast_${prediction.store}_${prediction.product}_${prediction.date}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const scrollToSection = (section) => {
    setActiveSection(section)
    setTimeout(() => {
      let selector = ''
      switch(section) {
        case 'summaries':
          selector = '.hero-copy'
          break
        case 'trend':
          selector = '.chart-wrap'
          break
        case 'guidance':
          selector = '.insight-panel'
          break
        case 'demand':
          selector = '.hero-highlight'
          break
        case 'promo':
          selector = '.comparison-panel'
          break
        default:
          return
      }
      const element = document.querySelector(selector)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        element.classList.add('highlight-pulse')
        setTimeout(() => element.classList.remove('highlight-pulse'), 2000)
      }
    }, 100)
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

      <div className="hero-card">
        <div className="hero-copy">
          <p className="hero-label">Made for teams, not just analysts</p>
          <h2>See what demand is likely to do before your team reacts.</h2>
          <p>
            This dashboard turns forecast numbers into plain-language guidance so planning, sales, and operations can make faster decisions.
          </p>
          <div className="hero-tags">
            <span className="pill clickable" onClick={() => scrollToSection('summaries')} title="View simple summaries">Simple summaries</span>
            <span className="pill clickable" onClick={() => scrollToSection('trend')} title="View clear trend view">Clear trend view</span>
            <span className="pill clickable" onClick={() => scrollToSection('guidance')} title="View action-ready guidance">Action-ready guidance</span>
          </div>
        </div>

        <div className={`hero-highlight ${insight.tone}`}>
          <p className="hero-highlight-title">Current outlook</p>
          <div className="hero-highlight-value">{prediction ? formatNumber(prediction.predicted_units_sold) : '—'}</div>
          <p className="hero-highlight-sub">{prediction ? insight.summary : 'Pick a store, product, and date to generate a forecast.'}</p>
          <div className="hero-chips">
            <span className="pill clickable" onClick={() => scrollToSection('demand')} title="View steady demand details">{insight.title}</span>
            <span className="pill clickable" onClick={() => scrollToSection('promo')} title="Compare promo impact">{promo ? 'Promo active' : 'No promo'}</span>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <p className="panel-title">Ask the forecast</p>
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

        <div>
          <div className="metrics-row">
            <div className="metric-card">
              <p className="metric-label"><span style={{ background: 'var(--teal)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', marginRight: '6px' }}>1</span>Expected sales</p>
              <p className="metric-value">{prediction ? `${formatNumber(prediction.predicted_units_sold)} units` : '—'}</p>
              <p className="metric-footnote">{prediction ? insight.deltaLabel : 'Forecast will appear here'}</p>
              <div className="card-actions">
                <button className="action-btn" onClick={() => setExpandedCard(expandedCard === 'sales' ? null : 'sales')}>
                  {expandedCard === 'sales' ? 'Hide' : 'Details'}
                </button>
                <button className="action-btn" onClick={() => prediction && navigator.clipboard.writeText(`${prediction.predicted_units_sold} units`)}>
                  Copy
                </button>
              </div>
              {expandedCard === 'sales' && prediction && (
                <div className="card-details">
                  <p><strong>Store:</strong> {prediction.store}</p>
                  <p><strong>Product:</strong> {prediction.product}</p>
                  <p><strong>Date:</strong> {prediction.date}</p>
                  <p><strong>Current Selection:</strong> {promo ? 'WITH Promo' : 'WITHOUT Promo'}</p>
                  <p><strong>Predicted Units:</strong> {formatNumber(prediction.predicted_units_sold)}</p>
                  {comparisonData && (
                    <>
                      <p className="detail-text" style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}><strong>Comparison:</strong></p>
                      <p><strong>With Promo:</strong> {formatNumber(comparisonData[0]?.value)} units</p>
                      <p><strong>Without Promo:</strong> {formatNumber(comparisonData[1]?.value)} units</p>
                      {comparisonData[0]?.value && comparisonData[1]?.value && (
                        <p className="detail-text"><strong>Impact:</strong> +{formatNumber(((comparisonData[0].value - comparisonData[1].value) / comparisonData[1].value) * 100)}%</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="metric-card">
              <p className="metric-label"><span style={{ background: 'var(--teal)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', marginRight: '6px' }}>2</span>Model accuracy</p>
              <p className="metric-value accent">{metrics ? formatNumber(metrics.MAE) : '—'}</p>
              <p className="metric-footnote">Mean absolute error</p>
              <div className="card-actions">
                <button className="action-btn" onClick={() => setExpandedCard(expandedCard === 'accuracy' ? null : 'accuracy')}>
                  {expandedCard === 'accuracy' ? 'Hide' : 'Details'}
                </button>
                <button className="action-btn" onClick={() => setExpandedCard(expandedCard === 'metrics' ? null : 'metrics')}>
                  All metrics
                </button>
              </div>
              {expandedCard === 'accuracy' && metrics && (
                <div className="card-details">
                  <p><strong>MAE (Mean Absolute Error):</strong> {formatNumber(metrics.MAE)}</p>
                  <p className="detail-text">Average absolute difference between predicted and actual values.</p>
                  {metrics.RMSE && <p><strong>RMSE:</strong> {formatNumber(metrics.RMSE)}</p>}
                  {metrics.train_rows && <p><strong>Training Rows:</strong> {metrics.train_rows.toLocaleString()}</p>}
                  {metrics.test_rows && <p><strong>Test Rows:</strong> {metrics.test_rows.toLocaleString()}</p>}
                </div>
              )}
              {expandedCard === 'metrics' && metrics && (
                <div className="card-details">
                  <p><strong>MAE:</strong> {formatNumber(metrics.MAE)} units</p>
                  <p><strong>RMSE:</strong> {formatNumber(metrics.RMSE)} units</p>
                  <p><strong>R² Score:</strong> {formatNumber(metrics.R2)}</p>
                  {metrics.train_rows && <p><strong>Training Samples:</strong> {metrics.train_rows.toLocaleString()}</p>}
                  {metrics.test_rows && <p><strong>Test Samples:</strong> {metrics.test_rows.toLocaleString()}</p>}
                  <p className="detail-text">Lower MAE/RMSE = better accuracy. R² closer to 1 = better fit.</p>
                </div>
              )}
            </div>
            <div className="metric-card">
              <p className="metric-label"><span style={{ background: 'var(--teal)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', marginRight: '6px' }}>3</span>Confidence</p>
              <p className="metric-value">{metrics ? `${formatNumber(metrics.R2)}` : '—'}</p>
              <p className="metric-footnote">R² score from latest evaluation</p>
              <div className="card-actions">
                <button className="action-btn" onClick={() => setExpandedCard(expandedCard === 'confidence' ? null : 'confidence')}>
                  {expandedCard === 'confidence' ? 'Hide' : 'Details'}
                </button>
              </div>
              {expandedCard === 'confidence' && metrics && (
                <div className="card-details">
                  <p><strong>R² Score:</strong> {formatNumber(metrics.R2)}</p>
                  <p className="detail-text">Measures how well the model explains variance in the data. Range: 0 to 1.</p>
                  <p className="confidence-level">
                    {metrics.R2 > 0.8 ? '✓ High confidence' : metrics.R2 > 0.6 ? '~ Moderate confidence' : '⚠ Low confidence'}
                  </p>
                  {metrics.MAE && <p><strong>Avg Error:</strong> ±{formatNumber(metrics.MAE)} units</p>}
                </div>
              )}
            </div>
          </div>

          {comparisonData && (
            <div className="panel comparison-panel">
              <p className="panel-title">Promo Impact Analysis</p>
              <p className="panel-subtitle">How does promotion affect expected demand?</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={comparisonData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#223052" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#8793AC" />
                  <YAxis stroke="#8793AC" />
                  <Tooltip 
                    contentStyle={{
                      background: '#162135', border: '1px solid #223052', borderRadius: 8,
                      padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12,
                    }}
                    formatter={(value) => formatNumber(value)}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="comparison-insight">
                {comparisonData[0] && comparisonData[1] && (
                  <p>
                    <strong>Impact:</strong> Promotion could increase sales by{' '}
                    {formatNumber(((comparisonData[0].value - comparisonData[1].value) / comparisonData[1].value) * 100)}%
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="panel insight-panel">
            <p className="panel-title">What this means</p>
            <ul className="insight-list">
              <li><strong>{insight.title}</strong> — {insight.summary}</li>
              <li><strong>Suggested action:</strong> {insight.action}</li>
              <li>{metricsSource ? `Model source: ${metricsSource}` : 'Model metrics will update once the evaluation data is available.'}</li>
            </ul>
          </div>

          <div className="chart-wrap">
            <div className="chart-head">
              <div>
                <p className="panel-title">Demand trend around the selected day</p>
                <p className="chart-subtitle">A simple view of how the forecast changes over the next week.</p>
              </div>
              <div>
                <span className="info-chip">{prediction ? `${prediction.store} · ${prediction.product}` : 'No forecast yet'}</span>
                {prediction && (
                  <button className="export-btn" onClick={handleExportData} title="Export forecast data">
                    Export
                  </button>
                )}
              </div>
            </div>
            {forecast.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={forecast} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#21C7A8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#21C7A8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#223052" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#8793AC" fontSize={11} tickLine={false} axisLine={{ stroke: '#223052' }} />
                  <YAxis stroke="#8793AC" fontSize={11} tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={forecast.reduce((sum, point) => sum + point.units, 0) / forecast.length} stroke="#F0A63F" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="units"
                    stroke="#21C7A8"
                    fillOpacity={1}
                    fill="url(#colorUnits)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#21C7A8', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="empty-state">Run a forecast to plot the surrounding 10-day window.</p>
            )}
          </div>

          {forecast.length > 0 && (
            <div className="chart-wrap">
              <p className="panel-title">Daily breakdown</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={forecast} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#223052" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#8793AC" fontSize={11} />
                  <YAxis stroke="#8793AC" fontSize={11} />
                  <Tooltip 
                    contentStyle={{
                      background: '#162135', border: '1px solid #223052', borderRadius: 8,
                      padding: '8px 12px', fontFamily: 'IBM Plex Mono', fontSize: 12,
                    }}
                    formatter={(value) => formatNumber(value)}
                  />
                  <Bar dataKey="units" fill="#5DA7FF" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="panel">
            <p className="panel-title">Recent requests</p>
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
                      <td>{formatNumber(row.predicted_units_sold)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">No forecasts have been run yet in this session.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
