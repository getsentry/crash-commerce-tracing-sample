import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import * as Sentry from '@sentry/react'
import { 
  ShoppingBag, 
  X, 
  Plus, 
  Minus, 
  Sparkles, 
  Zap, 
  Shield, 
  Star,
  ChevronRight,
  Package,
  Truck,
  CreditCard,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import clsx from 'clsx'

type Product = {
  id: string
  name: string
  description: string
  priceMinor: number
  badge?: string
  color?: string
}

type CartLine = {
  productId: string
  quantity: number
}

const PAYMENT_PROVIDERS = ['ZapPay', 'GlitchPay', 'LagPay'] as const
type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]
type ProviderConfig = { minMs: number; maxMs: number; failureRate: number }

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5174'

// Product icon mapping
const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  'npe': <Zap className="w-32 h-32 drop-shadow-2xl" />,
  'typeerror': <Sparkles className="w-32 h-32 drop-shadow-2xl" />,
  'segfault': <Shield className="w-32 h-32 drop-shadow-2xl" />,
  'syntax': <Star className="w-32 h-32 drop-shadow-2xl" />,
  'oom': <Package className="w-32 h-32 drop-shadow-2xl" />,
}

function formatMoney(minor: number) {
  return `$${(minor / 100).toFixed(2)}`
}

// Hero Section Component
function HeroSection() {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 300], [0, 50])
  const opacity = useTransform(scrollY, [0, 300], [1, 0.3])

  return (
    <motion.section 
      className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-24"
      style={{ y, opacity }}
    >
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-48 -left-48 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-48 -right-48 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium text-white mb-6">
            <Sparkles className="w-4 h-4" />
            Limited Time Offer
          </span>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
            Crash Commerce
          </h1>
          <p className="text-xl md:text-2xl text-purple-100 mb-8 max-w-3xl mx-auto">
            Premium software bugs for the discerning developer. 
            Hand-crafted exceptions delivered straight to your codebase.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-lg shadow-2xl hover:shadow-purple-500/25 transition-shadow"
          >
            Shop Now
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </div>
    </motion.section>
  )
}

// Product Card Component
function ProductCard({ product, onAddToCart }: { product: Product & { icon?: React.ReactNode }; onAddToCart: () => void }) {
  const [ref, inView] = useInView({
    threshold: 0.1,
    triggerOnce: true
  })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="group relative"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
      
      <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300">
        {/* Product image placeholder with gradient */}
        <div className={`h-48 bg-gradient-to-br ${product.color || 'from-purple-600 to-pink-600'} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/20" />
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-white/40">
              {product.icon || <Package className="w-32 h-32 drop-shadow-2xl" />}
            </div>
          </motion.div>
          {product.badge && (
            <motion.span
              initial={{ x: -100 }}
              animate={{ x: 0 }}
              className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold uppercase tracking-wider"
            >
              {product.badge}
            </motion.span>
          )}
        </div>

        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{product.name}</h3>
          <p className="text-sm text-white/60 mb-4 line-clamp-2 min-h-[2.5rem]">
            {product.description}
          </p>
          
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-white">
                {formatMoney(product.priceMinor)}
              </span>
              <span className="text-xs text-white/40 ml-2 line-through">
                {formatMoney(product.priceMinor * 1.5)}
              </span>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddToCart}
              data-testid={`add-${product.id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium text-sm hover:shadow-lg hover:shadow-purple-500/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Cart Drawer Component
function CartDrawer({ 
  isOpen, 
  onClose, 
  cart, 
  onRemove, 
  onUpdateQuantity,
  onCheckout,
  isCheckingOut,
  paymentProvider,
  onChangeProvider,
  providerConfig,
  products
}: {
  isOpen: boolean
  onClose: () => void
  cart: CartLine[]
  onRemove: (productId: string) => void
  onUpdateQuantity: (productId: string, quantity: number) => void
  onCheckout: () => void
  isCheckingOut: boolean
  paymentProvider: PaymentProvider
  onChangeProvider: (provider: PaymentProvider) => void
  providerConfig?: Record<PaymentProvider, ProviderConfig> | null
  products: Product[]
}) {
  const cartValueMinor = useMemo(() => {
    return cart.reduce((sum, line) => {
      const product = products.find((p) => p.id === line.productId)
      return sum + (product ? product.priceMinor * line.quantity : 0)
    }, 0)
  }, [cart, products])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-6 h-6" />
                Your Cart
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </motion.button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60">Your cart is empty</p>
                  <p className="text-white/40 text-sm mt-2">Add some bugs to get started!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {cart.map((line) => {
                      const product = products.find((p) => p.id === line.productId)
                      if (!product) return null
                      return (
                        <motion.div
                          key={line.productId}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="bg-white/5 border border-white/10 rounded-xl p-4"
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${product.color || 'from-purple-600 to-pink-600'} flex items-center justify-center`}>
                              {PRODUCT_ICONS[product.id] || <Package className="w-8 h-8 text-white/50" />}
                            </div>
                            
                            <div className="flex-1">
                              <h3 className="font-medium text-white">{product.name}</h3>
                              <p className="text-sm text-white/60 mt-1">
                                {formatMoney(product.priceMinor)} each
                              </p>
                              
                              <div className="flex items-center gap-3 mt-3">
                                <div className="flex items-center gap-1 bg-white/10 rounded-full">
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => onUpdateQuantity(product.id, Math.max(0, line.quantity - 1))}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                  >
                                    <Minus className="w-4 h-4 text-white" />
                                  </motion.button>
                                  <span className="px-3 text-white font-medium">{line.quantity}</span>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => onUpdateQuantity(product.id, line.quantity + 1)}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                  >
                                    <Plus className="w-4 h-4 text-white" />
                                  </motion.button>
                                </div>
                                
                                <button
                                  onClick={() => onRemove(product.id)}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className="text-lg font-bold text-white">
                                {formatMoney(product.priceMinor * line.quantity)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="border-t border-white/10 p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Subtotal</span>
                  <span className="text-2xl font-bold text-white">
                    {formatMoney(cartValueMinor)}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white/60">
                    <Truck className="w-4 h-4" />
                    <span>Free shipping on orders over $50</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <CreditCard className="w-4 h-4" />
                    <span>Secure checkout with {paymentProvider}</span>
                  </div>
                </div>
                
                {/* Payment Provider Selection */}
                <div className="space-y-2">
                  <span className="text-white/80 text-sm font-medium">Payment method</span>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
                    {PAYMENT_PROVIDERS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        data-testid={`payment-${p}`}
                        onClick={() => onChangeProvider(p)}
                        className={clsx(
                          'px-3 py-2 rounded-lg border text-sm',
                          p === paymentProvider
                            ? 'bg-purple-600/30 border-purple-500/50 text-white'
                            : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                        )}
                        aria-pressed={p === paymentProvider}
                      >
                        <span className="block">{p}</span>
                        {providerConfig && providerConfig[p] && (
                          <span className="block text-[10px] text-white/60 mt-1">
                            {providerConfig[p].minMs}-{providerConfig[p].maxMs}ms • {Math.round(providerConfig[p].failureRate * 100)}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCheckout}
                  disabled={isCheckingOut}
                  id="checkout-button"
                  className="w-full py-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50"
                >
                  {isCheckingOut ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      Processing...
                    </span>
                  ) : (
                    'Checkout'
                  )}
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function App() {
  const [cart, setCart] = useState<CartLine[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [addedToCart, setAddedToCart] = useState<string | null>(null)
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('ZapPay')
  const [providerConfig, setProviderConfig] = useState<Record<PaymentProvider, ProviderConfig> | null>(null)
  const [orderConfirmation, setOrderConfirmation] = useState<{ orderId: string; provider: string; total: number } | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])

  const cartCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart]
  )

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Fetch products from backend
    fetch(`${API_URL}/api/products`)
      .then((r) => r.json())
      .then((data) => setProducts(data))
      .catch((err) => {
        console.error('Failed to fetch products:', err)
        setProducts([])
      })

    // Fetch payment config
    fetch(`${API_URL}/api/payment-config`)
      .then((r) => r.json())
      .then((cfg) => setProviderConfig(cfg))
      .catch(() => setProviderConfig(null))
  }, [])

  function addToCart(productId: string) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId)
      if (existing) {
        return prev.map((l) =>
          l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      return [...prev, { productId, quantity: 1 }]
    })
    
    // Show toast notification
    const product = products.find(p => p.id === productId)
    if (product) {
      setAddedToCart(`✨ Added ${product.name} to cart`)
      setTimeout(() => setAddedToCart(null), 3000)
    }
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId)
    } else {
      setCart((prev) =>
        prev.map((l) =>
          l.productId === productId ? { ...l, quantity } : l
        )
      )
    }
  }

  async function onCheckoutClick() {
    setIsCheckingOut(true)
    setCheckoutError(null)

    const cartValueMinor = cart.reduce((sum, line) => {
      const product = products.find((p) => p.id === line.productId)
      return sum + (product ? product.priceMinor * line.quantity : 0)
    }, 0)

    await Sentry.startSpan(
      {
        name: 'Checkout',
        op: 'ui.action',
        attributes: {
          'cart.item_count': cartCount,
          'cart.value_minor': cartValueMinor,
          'cart.currency': 'USD',
          'payment.provider.ui_selected': paymentProvider,
        },
      },
      async (span) => {
        try {
          const response = await fetch(`${API_URL}/api/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart, paymentProvider }),
          })
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Payment failed' }))
            throw new Error(errorData.error || `HTTP ${response.status}`)
          }
          const data: { orderId: string; paymentProvider: string } = await response.json()
          span.setAttribute('order.id', data.orderId)
          span.setAttribute('payment.provider', data.paymentProvider)
          Sentry.logger.info(Sentry.logger.fmt`✨ Order ${data.orderId} confirmed via ${data.paymentProvider}`)
          
          // Show order confirmation
          setOrderConfirmation({
            orderId: data.orderId,
            provider: data.paymentProvider,
            total: cartValueMinor
          })
          setCart([])
          setIsCartOpen(false)
        } catch (err) {
          span.setStatus({ code: 2, message: 'internal_error' })
          const errorMessage = err instanceof Error ? err.message : 'Checkout failed'
          setCheckoutError(errorMessage)
          Sentry.logger.error(`❌ ${errorMessage}`)
          Sentry.captureException(err)
        } finally {
          setIsCheckingOut(false)
        }
      }
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <motion.header 
        className={clsx(
          "sticky top-0 z-30 transition-all duration-300",
          isScrolled ? "bg-slate-900/95 backdrop-blur-lg border-b border-white/10" : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 grid place-items-center font-bold text-white shadow-lg"
              >
                C
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-white">Crash Commerce</h1>
                <p className="text-xs text-white/60">Premium bugs since 2024</p>
              </div>
            </motion.div>

            <motion.button
              id="cart-button"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all"
            >
              <ShoppingBag className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Cart</span>
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold grid place-items-center"
                >
                  {cartCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Toast Notification for Add to Cart */}
      <AnimatePresence>
        {addedToCart && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed top-20 left-1/2 z-40 px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium shadow-lg shadow-purple-500/25"
          >
            {addedToCart}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <HeroSection />

      {/* Error Toast */}
      <AnimatePresence>
        {checkoutError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md"
          >
            <div className="flex items-center gap-3 rounded-xl bg-red-500/20 border border-red-500/30 backdrop-blur-sm px-6 py-4">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-white">{checkoutError}</p>
              <button 
                onClick={() => setCheckoutError(null)}
                className="ml-auto text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Confirmation Modal */}
      <AnimatePresence>
        {orderConfirmation && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderConfirmation(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
            >
              <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="inline-flex p-3 rounded-full bg-green-500/20 text-green-400 mb-4"
                >
                  <CheckCircle className="w-12 h-12" />
                </motion.div>
                
                <h2 className="text-2xl font-bold text-white mb-2">Order Confirmed!</h2>
                <p className="text-white/60 mb-6">Your bugs are on their way</p>
                
                <div className="space-y-3 text-left bg-white/5 rounded-xl p-4 mb-6">
                  <div className="flex justify-between">
                    <span className="text-white/60">Order ID</span>
                    <span className="text-white font-mono">#{orderConfirmation.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Payment Provider</span>
                    <span className="text-white">{orderConfirmation.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Total</span>
                    <span className="text-white font-bold">{formatMoney(orderConfirmation.total)}</span>
                  </div>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setOrderConfirmation(null)}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  Continue Shopping
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Products Section */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-white mb-4">Featured Errors</h2>
          <p className="text-white/60 text-lg">Handpicked exceptions for every occasion</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={{ ...product, icon: PRODUCT_ICONS[product.id] }}
              onAddToCart={() => addToCart(product.id)}
            />
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 py-16 border-t border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <Truck />, title: "Fast Delivery", desc: "Bugs delivered in milliseconds" },
            { icon: <Shield />, title: "100% Guaranteed", desc: "Every error works as intended" },
            { icon: <Sparkles />, title: "Premium Quality", desc: "Hand-crafted exceptions" }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="inline-flex p-3 rounded-full bg-white/10 text-white mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-white/60">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onRemove={removeFromCart}
        onUpdateQuantity={updateQuantity}
        onCheckout={onCheckoutClick}
        isCheckingOut={isCheckingOut}
        paymentProvider={paymentProvider}
        onChangeProvider={setPaymentProvider}
        providerConfig={providerConfig}
        products={products}
      />

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-white/40 text-sm">
            © 2024 Crash Commerce · Built with React, Tailwind, Framer Motion
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App