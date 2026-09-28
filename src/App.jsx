import { useState, useEffect, useMemo, useRef } from 'react'

const API = 'http://localhost:3000/api'

export default function App() {
  const [menuData, setMenuData] = useState([])
  const [serverOffline, setServerOffline] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')
  const [cart, setCart] = useState([])
  const [cardsShown, setCardsShown] = useState(false)

  // view: 'main' | 'cartReview' | 'payment' | 'status' | 'history'
  const [view, setView] = useState('main')

  const [token, setToken] = useState(null)
  const [orderStatus, setOrderStatus] = useState('pending') // pending | preparing | ready
  const [rating, setRating] = useState(0)

  const pollRef = useRef(null)

  // --- Load menu on mount ---
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${API}/menu`)
        const data = await res.json()
        setMenuData(data)
      } catch (e) {
        setServerOffline(true)
      }
    }
    init()
  }, [])

  const categories = useMemo(() => {
    return ['All', ...new Set(menuData.map((i) => i.cat))]
  }, [menuData])

  const items = useMemo(() => {
    const q = search.toLowerCase()
    return menuData.filter(
      (i) =>
        (selectedCat === 'All' || i.cat === selectedCat) &&
        i.name.toLowerCase().includes(q)
    )
  }, [menuData, search, selectedCat])

  // trigger the same staggered "show" card animation as the original
  useEffect(() => {
    setCardsShown(false)
    const t = setTimeout(() => setCardsShown(true), 50)
    return () => clearTimeout(t)
  }, [items])

  function addToCart(name, price) {
    setCart((prev) => {
      const existing = prev.find((i) => i.name === name)
      if (existing) {
        return prev.map((i) =>
          i.name === name ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [...prev, { name, price, qty: 1 }]
    })
  }

  function removeFromCart(idx) {
    setCart((prev) => {
      const next = [...prev]
      next[idx].qty -= 1
      if (next[idx].qty <= 0) next.splice(idx, 1)
      return next
    })
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)

  // close review screen automatically if cart empties out
  useEffect(() => {
    if (view === 'cartReview' && cart.length === 0) setView('main')
  }, [cart, view])

  async function finalize(method) {
    const total = cartTotal
    try {
      const res = await fetch(`${API}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, total, paymentMethod: method }),
      })
      const data = await res.json()
      setToken(data.token)
      setOrderStatus('pending')
      setRating(0)

      const h = JSON.parse(localStorage.getItem('c_h') || '[]')
      h.push({ t: data.token, amt: total, d: new Date().toLocaleDateString() })
      localStorage.setItem('c_h', JSON.stringify(h))

      setView('status')
    } catch (e) {
      alert('Could not place order. Is the server running?')
    }
  }

  // --- poll order status while on the status screen ---
  useEffect(() => {
    if (view !== 'status' || !token) return

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/order/status/${token}`)
        const d = await r.json()
        setOrderStatus(d.status)
        if (d.status === 'ready') {
          clearInterval(pollRef.current)
        }
      } catch (e) {
        // ignore transient poll failures
      }
    }, 3000)

    return () => clearInterval(pollRef.current)
  }, [view, token])

  async function submitRate(s) {
    setRating(s)
    try {
      await fetch(`${API}/order/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating: s }),
      })
    } catch (e) {
      // ignore
    }
    setTimeout(() => {
      // reset to a fresh menu, like the original's location.reload()
      setCart([])
      setToken(null)
      setOrderStatus('pending')
      setRating(0)
      setView('main')
    }, 1000)
  }

  const orderHistory = useMemo(() => {
    if (view !== 'history') return []
    const h = JSON.parse(localStorage.getItem('c_h') || '[]')
    return h.reverse()
  }, [view])

  const stepLabel = {
    pending: { tag: 'CONFIRMED', color: 'gray', msg: 'Waiting for kitchen...' },
    preparing: { tag: 'COOKING', color: 'var(--brand)', msg: 'Chef is cooking your meal! 👨‍🍳' },
    ready: { tag: 'PICK UP', color: '#00FF88', msg: 'READY AT COUNTER ✅' },
  }[orderStatus]

  return (
    <>
      <div className="aura"></div>
      <div className="aura-2"></div>

      {view === 'main' && (
        <div id="main-view">
          <nav>
            <div className="nav-container">
              <button className="history-btn" onClick={() => setView('history')}>
                🕒
              </button>
              <div className="logo">
                Crave<span>ly.</span>
              </div>
            </div>
          </nav>

          <input
            type="text"
            className="search-bar"
            placeholder="What are you craving?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="categories">
            {categories.map((c) => (
              <div
                key={c}
                className={`pill ${selectedCat === c ? 'active' : ''}`}
                onClick={() => setSelectedCat(c)}
              >
                {c}
              </div>
            ))}
          </div>

          <div className="container">
            {serverOffline ? (
              <p>Server Offline.</p>
            ) : (
              items.map((i, idx) => (
                <div
                  key={i.name}
                  className={`card ${cardsShown ? 'show' : ''}`}
                  style={{ transitionDelay: `${idx * 60}ms` }}
                >
                  <div className="card-img-wrap">
                    <img src={i.img} alt={i.name} />
                    <button
                      className="add-btn"
                      onClick={() => addToCart(i.name, i.price)}
                    >
                      +
                    </button>
                  </div>
                  <div className="card-info">
                    <b>{i.name}</b>
                    <small style={{ color: 'var(--muted)' }}>₹{i.price}</small>
                  </div>
                </div>
              ))
            )}
          </div>

          {cartCount > 0 && (
            <div id="cart-bar">
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                🛒 <span>{cartCount}</span> DISHES
              </div>
              <button className="checkout-btn" onClick={() => setView('cartReview')}>
                Review Order
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'cartReview' && (
        <div className="full-screen" style={{ display: 'block' }}>
          <button
            className="history-btn"
            style={{ position: 'absolute', top: 50, left: 25 }}
            onClick={() => setView('main')}
          >
            ←
          </button>
          <h2 style={{ fontWeight: 900, fontSize: 34, marginBottom: 40 }}>My Order</h2>
          <div>
            {cart.map((i, idx) => (
              <div
                key={i.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '18px 0',
                  borderBottom: '1px solid #222',
                }}
              >
                <span>
                  {i.name}{' '}
                  {i.qty > 1 && <b style={{ color: 'var(--brand)' }}>x{i.qty}</b>}
                </span>
                <button
                  onClick={() => removeFromCart(idx)}
                  style={{
                    color: 'var(--brand)',
                    background: 'none',
                    border: 'none',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 26,
              margin: '40px 0',
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid #222',
              paddingTop: 25,
            }}
          >
            <span>Grand Total</span>
            <b style={{ color: 'var(--brand)' }}>₹{cartTotal}</b>
          </div>
          <button className="secondary-btn" onClick={() => setView('main')}>
            Back to Menu
          </button>
          <button className="primary-btn" onClick={() => setView('payment')}>
            PAY & PLACE ORDER
          </button>
        </div>
      )}

      {view === 'payment' && (
        <div className="full-screen" style={{ display: 'block' }}>
          <h2 style={{ fontWeight: 900, fontSize: 34 }}>Checkout</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 40 }}>Select Payment Method</p>
          <div
            onClick={() => finalize('UPI')}
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              padding: 25,
              borderRadius: 28,
              marginBottom: 20,
              cursor: 'pointer',
              fontWeight: 800,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            📱 UPI / Google Pay <span>→</span>
          </div>
          <div
            onClick={() => finalize('Cash')}
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              padding: 25,
              borderRadius: 28,
              cursor: 'pointer',
              fontWeight: 800,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            💵 Cash at Counter <span>→</span>
          </div>
        </div>
      )}

      {view === 'status' && (
        <div className="full-screen" style={{ display: 'block' }}>
          <div className="success-card-3d">
            <div
              style={{
                fontWeight: 900,
                fontSize: 12,
                color: stepLabel.color,
                letterSpacing: 3,
              }}
            >
              {stepLabel.tag}
            </div>
            <div className="token-3d">#{token ?? '---'}</div>
            <div
              className="stepper-3d"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                position: 'relative',
                padding: '0 20px',
              }}
            >
              <div className="step-ball active">1</div>
              <div
                className={`step-ball ${
                  orderStatus === 'preparing' ? 'active' : ''
                } ${orderStatus === 'ready' ? 'done' : ''}`}
              >
                2
              </div>
              <div className={`step-ball ${orderStatus === 'ready' ? 'active' : ''}`}>
                3
              </div>
            </div>
            <h2 style={{ fontSize: 20, marginTop: 20 }}>
              {orderStatus === 'ready' ? (
                <b style={{ color: '#00FF88' }}>{stepLabel.msg}</b>
              ) : (
                stepLabel.msg
              )}
            </h2>

            {orderStatus === 'ready' && (
              <div
                style={{
                  marginTop: 40,
                  borderTop: '1px solid #222',
                  paddingTop: 30,
                }}
              >
                <p style={{ fontWeight: 700, color: 'var(--muted)' }}>Rate the taste</p>
                <div>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={`star ${s <= rating ? 'active' : ''}`}
                      onClick={() => submitRate(s)}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <button
                  className="primary-btn"
                  onClick={() => {
                    setCart([])
                    setToken(null)
                    setOrderStatus('pending')
                    setRating(0)
                    setView('main')
                  }}
                >
                  Back to Menu
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="full-screen" style={{ display: 'block' }}>
          <h2 style={{ fontWeight: 900 }}>Recent Orders</h2>
          <div style={{ margin: '30px 0' }}>
            {orderHistory.map((i, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--glass)',
                  border: '1px solid var(--glass-border)',
                  padding: 20,
                  borderRadius: 24,
                  marginBottom: 15,
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <b>Order #{i.t}</b>
                  <small style={{ color: 'var(--muted)' }}>{i.d}</small>
                </div>
                <div style={{ color: 'var(--brand)', fontWeight: 900, marginTop: 5, fontSize: 20 }}>
                  ₹{i.amt}
                </div>
              </div>
            ))}
          </div>
          <button className="primary-btn" onClick={() => setView('main')}>
            Return
          </button>
        </div>
      )}
    </>
  )
}
