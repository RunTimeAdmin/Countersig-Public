import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import OrgSwitcher from './components/OrgSwitcher';
import Registry from './pages/Registry';
import AgentDetail from './pages/AgentDetail';
import Register from './pages/Register';
import Discover from './pages/Discover';
import Demo from './pages/Demo';
import Security from './pages/Security';
import Guides from './pages/Guides';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';
import AgentGroups from './pages/AgentGroups';
import Policies from './pages/Policies';
import WhyAgentID from './pages/WhyAgentID';
import RouteErrorBoundary from './components/RouteErrorBoundary';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Route error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#666' }}>An unexpected error occurred. Please try refreshing the page.</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isActive = (path) => location.pathname === path;

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
    handleNavClick();
  };

  return (
    <nav className="glass sticky top-0 z-50 border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group" onClick={handleNavClick}>
            <img src="/AgentIDLogo.png" alt="AgentID" className="w-10 h-10 rounded-xl shadow-lg group-hover:shadow-[var(--shadow-glow-cyan)] transition-shadow duration-300" />
            <span className="text-xl font-bold gradient-text">AgentID</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-1">
            {isAuthenticated && (
              <>
                <NavLink to="/dashboard" active={isActive('/dashboard')}>Dashboard</NavLink>
                <NavLink to="/audit" active={isActive('/audit')}>Audit</NavLink>
                <NavLink to="/groups" active={isActive('/groups')}>Groups</NavLink>
                <NavLink to="/policies" active={isActive('/policies')}>Policies</NavLink>
              </>
            )}
            <NavLink to="/why" active={isActive('/why')}>Why AgentID</NavLink>
            <NavLink to="/" active={isActive('/')}>Registry</NavLink>
            <NavLink to="/discover" active={isActive('/discover')}>Discover</NavLink>
            <NavLink to="/pricing" active={isActive('/pricing')}>Pricing</NavLink>
            <NavLink to="/register" active={isActive('/register')}>Register</NavLink>
            <NavLink to="/security" active={isActive('/security')}>Security</NavLink>
            <NavLink to="/guides" active={isActive('/guides')}>Guides</NavLink>
            <DemoNavLink to="/demo" active={isActive('/demo')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Try Demo
            </DemoNavLink>
          </div>

          {/* Auth Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <OrgSwitcher />
                <span className="text-sm text-[var(--text-secondary)] hidden lg:inline">{user?.name}</span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              aria-label="Toggle mobile menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[var(--border-subtle)] animate-fade-in">
            <div className="flex flex-col space-y-2">
              {isAuthenticated && (
                <>
                  <MobileNavLink to="/dashboard" active={isActive('/dashboard')} onClick={handleNavClick}>Dashboard</MobileNavLink>
                  <MobileNavLink to="/audit" active={isActive('/audit')} onClick={handleNavClick}>Audit</MobileNavLink>
                  <MobileNavLink to="/groups" active={isActive('/groups')} onClick={handleNavClick}>Groups</MobileNavLink>
                  <MobileNavLink to="/policies" active={isActive('/policies')} onClick={handleNavClick}>Policies</MobileNavLink>
                </>
              )}
              <MobileNavLink to="/why" active={isActive('/why')} onClick={handleNavClick}>Why AgentID</MobileNavLink>
              <MobileNavLink to="/" active={isActive('/')} onClick={handleNavClick}>Registry</MobileNavLink>
              <MobileNavLink to="/discover" active={isActive('/discover')} onClick={handleNavClick}>Discover</MobileNavLink>
              <MobileNavLink to="/pricing" active={isActive('/pricing')} onClick={handleNavClick}>Pricing</MobileNavLink>
              <MobileNavLink to="/register" active={isActive('/register')} onClick={handleNavClick}>Register</MobileNavLink>
              <MobileNavLink to="/security" active={isActive('/security')} onClick={handleNavClick}>Security</MobileNavLink>
              <MobileNavLink to="/guides" active={isActive('/guides')} onClick={handleNavClick}>Guides</MobileNavLink>
              <MobileDemoNavLink to="/demo" active={isActive('/demo')} onClick={handleNavClick}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Try Demo
              </MobileDemoNavLink>
              {isAuthenticated ? (
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-primary)] font-medium">{user?.name}</span>
                    <OrgSwitcher />
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <Link
                    to="/login"
                    onClick={handleNavClick}
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-center text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)]"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
      }`}
    >
      {children}
    </Link>
  );
}

function DemoNavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)]'
          : 'text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ to, active, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileDemoNavLink({ to, active, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)]'
          : 'text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)]'
      }`}
    >
      {children}
    </Link>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border-subtle)] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <img src="/AgentIDLogo.png" alt="AgentID" className="w-8 h-8 rounded-lg" />
            <span className="text-sm text-[var(--text-muted)]">
              AgentID — Trust Verification Layer for AI Agents
            </span>
          </div>
          <div className="flex items-center space-x-6 text-sm text-[var(--text-muted)]">
            <a href="/docs/index.html" className="hover:text-[var(--accent-cyan)] transition-colors">Documentation</a>
            <a href="https://github.com/RunTimeAdmin/AgentID-2.0-Public/blob/main/docs/API_REFERENCE.md" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-cyan)] transition-colors">API</a>
            <a href="https://github.com/RunTimeAdmin/AgentID-2.0-Public" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-cyan)] transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col">
          <Navigation />
          <main className="flex-1">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<RouteErrorBoundary><Registry /></RouteErrorBoundary>} />
                <Route path="/why" element={<RouteErrorBoundary><WhyAgentID /></RouteErrorBoundary>} />
                <Route path="/agents/:agentId" element={<RouteErrorBoundary><AgentDetail /></RouteErrorBoundary>} />
                <Route path="/discover" element={<RouteErrorBoundary><Discover /></RouteErrorBoundary>} />
                <Route path="/demo" element={<RouteErrorBoundary><Demo /></RouteErrorBoundary>} />
                <Route path="/security" element={<RouteErrorBoundary><Security /></RouteErrorBoundary>} />
                <Route path="/guides" element={<RouteErrorBoundary><Guides /></RouteErrorBoundary>} />
                <Route path="/pricing" element={<RouteErrorBoundary><Pricing /></RouteErrorBoundary>} />
                <Route path="/login" element={<RouteErrorBoundary><Login /></RouteErrorBoundary>} />
                <Route path="/signup" element={<RouteErrorBoundary><Signup /></RouteErrorBoundary>} />
                <Route path="/dashboard" element={<RouteErrorBoundary><ProtectedRoute><Dashboard /></ProtectedRoute></RouteErrorBoundary>} />
                <Route path="/settings" element={<RouteErrorBoundary><ProtectedRoute><Settings /></ProtectedRoute></RouteErrorBoundary>} />
                <Route path="/register" element={<RouteErrorBoundary><ProtectedRoute><Register /></ProtectedRoute></RouteErrorBoundary>} />
                <Route path="/audit" element={<RouteErrorBoundary><ProtectedRoute><AuditLog /></ProtectedRoute></RouteErrorBoundary>} />
                <Route path="/groups" element={<RouteErrorBoundary><ProtectedRoute><AgentGroups /></ProtectedRoute></RouteErrorBoundary>} />
                <Route path="/policies" element={<RouteErrorBoundary><ProtectedRoute><Policies /></ProtectedRoute></RouteErrorBoundary>} />
              </Routes>
            </ErrorBoundary>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
