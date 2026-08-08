import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Navbar.css';

const LANDING_SECTIONS = [
  'projects-section',
  'education-section',
  'contact-section',
];

function Navbar() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveSection(null);
      return undefined;
    }

    let cancelled = false;
    let rafId = 0;
    let ticking = false;

    const getSpyOffset = () => {
      const nav = document.querySelector('.navbar');
      return (nav?.getBoundingClientRect().height || 56) + 8;
    };

    const updateActiveSection = () => {
      if (cancelled) return;

      const offset = getSpyOffset();
      const scrollBottom = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // Near page bottom: Contact may not fill the spy band — force last section
      if (scrollBottom >= docHeight - 4) {
        setActiveSection('contact-section');
        return;
      }

      let current = null;
      LANDING_SECTIONS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.getBoundingClientRect().top - offset <= 0) {
          current = id;
        }
      });

      if (current) {
        setActiveSection(current);
      }
    };

    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateActiveSection();
      });
    };

    const waitForSections = () => {
      if (cancelled) return;
      const ready = LANDING_SECTIONS.every((id) => document.getElementById(id));
      if (!ready) {
        rafId = requestAnimationFrame(waitForSections);
        return;
      }
      updateActiveSection();
      window.addEventListener('scroll', onScrollOrResize, { passive: true });
      window.addEventListener('resize', onScrollOrResize);
    };

    waitForSections();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [location.pathname]);

  const scrollToSection = (sectionId) => {
    setMenuOpen(false);
    if (location.pathname !== '/') {
      window.location.href = `/#${sectionId}`;
      return;
    }

    const element = document.getElementById(sectionId);
    if (element) {
      setActiveSection(sectionId);
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
  };

  const closeMenu = () => setMenuOpen(false);

  const sectionLinkClass = (sectionId) =>
    `navbar-link${activeSection === sectionId ? ' navbar-link-active' : ''}`;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" aria-label={t('navbar.homeAria')}>
          <span className="navbar-logo-circle">
            <svg
              className="navbar-logo-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1v-4.25h-3V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </Link>

        <div className="navbar-right">
          <button
            type="button"
            className="navbar-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="navbar-mobile-menu"
            aria-label={menuOpen ? t('navbar.closeMenu') : t('navbar.openMenu')}
          >
            <span className="navbar-menu-bar" />
            <span className="navbar-menu-bar" />
            <span className="navbar-menu-bar" />
          </button>

          <nav
            id="navbar-mobile-menu"
            className={`navbar-links ${menuOpen ? 'navbar-links-open' : ''}`}
          >
            <Link to="/ToolsHome" className="navbar-link" onClick={closeMenu}>
              {t('navbar.tools')}
            </Link>

            <Link to="/GamesHome" className="navbar-link" onClick={closeMenu}>
              {t('navbar.games')}
            </Link>

            <button
              type="button"
              className={sectionLinkClass('projects-section')}
              aria-current={activeSection === 'projects-section' ? 'true' : undefined}
              onClick={() => scrollToSection('projects-section')}
            >
              {t('navbar.projects')}
            </button>

            <button
              type="button"
              className={sectionLinkClass('education-section')}
              aria-current={activeSection === 'education-section' ? 'true' : undefined}
              onClick={() => scrollToSection('education-section')}
            >
              {t('navbar.education')}
            </button>

            <button
              type="button"
              className={sectionLinkClass('contact-section')}
              aria-current={activeSection === 'contact-section' ? 'true' : undefined}
              onClick={() => scrollToSection('contact-section')}
            >
              {t('navbar.contact')}
            </button>

            <Link
              to="/Admin"
              className="navbar-link navbar-link-admin"
              onClick={closeMenu}
            >
              {t('navbar.admin')}
            </Link>
          </nav>

          <button
            type="button"
            className="navbar-lang-btn"
            onClick={() => handleLanguageChange(i18n.language === 'en' ? 'he' : 'en')}
            aria-label={i18n.language === 'en' ? t('navbar.langSwitchToHe') : t('navbar.langSwitchToEn')}
          >
            <svg
              className="navbar-lang-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="1.6"
              />
              <path
                d="M2 12h20M12 2a14 14 0 0 1 0 20M12 2a14 14 0 0 0 0 20"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <span className="navbar-lang-text">
              {i18n.language === 'he' ? 'HE' : 'EN'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
