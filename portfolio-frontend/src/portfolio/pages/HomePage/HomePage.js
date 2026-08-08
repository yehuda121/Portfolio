import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../HomePage/HomePage.css';
import { useTranslation } from 'react-i18next';

function Homepage() {
  const [showAllProjects, setShowAllProjects] = useState(false);
  const { t } = useTranslation();

  const coursework = useMemo(() => {
    const items = t('homepage.educationCoursework', { returnObjects: true });
    return Array.isArray(items) ? items : [];
  }, [t]);

  const trainingTopics = useMemo(() => {
    const items = t('homepage.educationTopics', { returnObjects: true });
    return Array.isArray(items) ? items : [];
  }, [t]);

  return (
    <div className="homepage">
      <section className="homepage-hero">
        <div className="homepage-hero-right">
          <div className="homepage-profile-glow">
            <div className="homepage-profile-image-wrapper">
              <img
                src="/profile.png"
                alt={t('homepage.profileAlt')}
                className="homepage-profile-image"
              />
            </div>
          </div>
        </div>

        <div className="homepage-hero-left">
          <span className="homepage-tag">{t('homepage.tag')}</span>
          <h1 className="homepage-name">{t('homepage.name')}</h1>
          <p className="homepage-role">{t('homepage.role')}</p>
          <p className="homepage-summary">{t('homepage.summary')}</p>

          <div className="homepage-actions">
            <a
              href="https://drive.google.com/file/d/1Wm3_TDWkRHEG5sb1uDZxwyLAVF_uRx2j/view?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="homepage-btn homepage-btn-primary"
            >
              {t('homepage.cvButton')}
            </a>

            <Link to="/degree" className="homepage-btn homepage-btn-secondary">
              {t('homepage.degreeButton')}
            </Link>

            <a
              href="https://www.linkedin.com/in/yehuda-shmulevitz/"
              target="_blank"
              rel="noopener noreferrer"
              className="homepage-btn homepage-btn-ghost"
            >
              {t('homepage.linkedinButton')}
            </a>
          </div>
        </div>
      </section>

      <section className="homepage-sections">
        <div className="homepage-card homepage-anchor" id="projects-section">
          <h2 className="homepage-card-title">{t('homepage.projectsTitle')}</h2>

          <div className="homepage-project">
            <h3>{t('homepage.projectPayrollTitle')}</h3>
            <p>{t('homepage.projectPayrollDesc')}</p>
            <p className="homepage-project-tech">{t('homepage.projectPayrollTech')}</p>
          </div>

          <div className="homepage-project">
            <h3>{t('homepage.projectAssistantTitle')}</h3>
            <p>{t('homepage.projectAssistantDesc')}</p>
            <p className="homepage-project-tech">{t('homepage.projectAssistantTech')}</p>
            <div className="homepage-project-links">
              <a
                href="https://github.com/yehuda121/Smart-Employee-Assistant"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('homepage.viewOnGithub')}
              </a>
            </div>
          </div>

          <div className="homepage-project">
            <h3>{t('homepage.projectMesayaTitle')}</h3>
            <p>{t('homepage.projectMesayaDesc')}</p>
            <p className="homepage-project-tech">{t('homepage.projectMesayaTech')}</p>
            <div className="homepage-project-links">
              <a
                href="https://docs.google.com/presentation/d/e/2PACX-1vSyZ1gSFUWk0Pk3quRsl8t14joQz48WpaQ_MRjPLk0N-8JKU_w2JB8U4W1EXjUYLw/pub?start=true&loop=false&delayms=3000"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('homepage.projectMesayaLink')}
              </a>
              <span> | </span>
              <span>{t('homepage.viewOnGithub')}:</span>
              <a href="https://github.com/yehuda121/mesayaatech-frontend" target="_blank" rel="noopener noreferrer">
                {t('homepage.FrontendLink')}
              </a>
              <a href="https://github.com/yehuda121/mesayaatech-backend" target="_blank" rel="noopener noreferrer">
                {t('homepage.BackendLink')}
              </a>
            </div>
          </div>

          {showAllProjects && (
            <>
              <div className="homepage-project">
                <h3>{t('homepage.projectHeartTitle')}</h3>
                <p>{t('homepage.projectHeartDesc')}</p>
                <p className="homepage-project-tech">{t('homepage.projectHeartTech')}</p>
                <div className="homepage-project-links">
                  <a href="https://github.com/yehuda121/heart_attack_prediction" target="_blank" rel="noopener noreferrer">
                    {t('homepage.viewOnGithub')}
                  </a>
                </div>
              </div>

              <div className="homepage-project">
                <h3>{t('homepage.projectWarehouseTitle')}</h3>
                <p>{t('homepage.projectWarehouseDesc')}</p>
                <p className="homepage-project-tech">{t('homepage.projectWarehouseTech')}</p>
                <div className="homepage-project-links">
                  <a href="https://quickshop-9702e.web.app/" target="_blank" rel="noopener noreferrer">
                    {t('homepage.projectWarehouseLink')}
                  </a>
                  <span> | </span>
                  <a href="https://github.com/yehuda121/quickshop" target="_blank" rel="noopener noreferrer">
                    {t('homepage.viewOnGithub')}
                  </a>
                </div>
              </div>

              <div className="homepage-project">
                <h3>{t('homepage.projectWizardTitle')}</h3>
                <p>{t('homepage.projectWizardDesc')}</p>
                <p className="homepage-project-tech">{t('homepage.projectWizardTech')}</p>
                <div className="homepage-project-links">
                  <a href="https://youtu.be/msOr3By3SdQ" target="_blank" rel="noopener noreferrer">
                    {t('homepage.projectWizardLink')}
                  </a>
                  <span> | </span>
                  <a href="https://github.com/yehuda121/wizard-arena-3d-unity" target="_blank" rel="noopener noreferrer">
                    {t('homepage.viewOnGithub')}
                  </a>
                </div>
              </div>

              <div className="homepage-project">
                <h3>{t('homepage.projectDiskTitle')}</h3>
                <p>{t('homepage.projectDiskDesc')}</p>
                <p className="homepage-project-tech">{t('homepage.projectDiskTech')}</p>
                <div className="homepage-project-links">
                  <a href="https://github.com/yehuda121/disk_simulator" target="_blank" rel="noopener noreferrer">
                    {t('homepage.viewOnGithub')}
                  </a>
                </div>
              </div>

              <div className="homepage-project">
                <h3>{t('homepage.projectExtTitle')}</h3>
                <p>{t('homepage.projectExtDesc')}</p>
                <p className="homepage-project-tech">{t('homepage.projectExtTech')}</p>
                <div className="homepage-project-links">
                  <a href="https://github.com/yehuda121/google-search-results-hider-extension" target="_blank" rel="noopener noreferrer">
                    {t('homepage.viewOnGithub')}
                  </a>
                  <span> | </span>
                  <a
                    href="https://chromewebstore.google.com/detail/search-results-hider/ceajphjdnekebeggfadieaoacnhjpebj"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('homepage.projectExtChrome')}
                  </a>
                </div>
              </div>
            </>
          )}

          <div className="homepage-project-toggle-wrapper">
            <button
              type="button"
              className="homepage-project-toggle"
              onClick={() => setShowAllProjects((prev) => !prev)}
            >
              {showAllProjects ? t('homepage.projectsShowLess') : t('homepage.projectsShowMore')}
            </button>
          </div>
        </div>

        <div className="homepage-card homepage-anchor" id="education-section">
          <h2 className="homepage-card-title">{t('homepage.educationTitle')}</h2>

          <div className="homepage-education-block">
            <h3 className="homepage-education-heading">{t('homepage.educationDegreeTitle')}</h3>
            <p className="homepage-education-meta">{t('homepage.educationDegreeSchool')}</p>
            <p className="homepage-education-gpa">{t('homepage.educationDegreeGpa')}</p>
            <p className="homepage-card-text">{t('homepage.educationDegreeDesc')}</p>

            <h4 className="homepage-education-subtitle">{t('homepage.educationCourseworkTitle')}</h4>
            <ul className="homepage-education-list">
              {coursework.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="homepage-education-actions">
              <Link to="/degree" className="homepage-btn homepage-btn-secondary">
                {t('homepage.degreeButton')}
              </Link>
            </div>
          </div>

          <div className="homepage-education-block homepage-education-block-secondary">
            <h3 className="homepage-education-heading">{t('homepage.educationTrainingTitle')}</h3>
            <p className="homepage-education-meta">{t('homepage.educationTrainingHours')}</p>
            <p className="homepage-card-text">{t('homepage.educationTrainingDesc')}</p>

            <h4 className="homepage-education-subtitle">{t('homepage.educationTopicsTitle')}</h4>
            <ul className="homepage-education-list">
              {trainingTopics.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="homepage-education-actions">
              <a
                href={`/${encodeURIComponent('Oz Varuah Certificate.jpeg')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="homepage-btn homepage-btn-secondary"
              >
                {t('homepage.certificateButton')}
              </a>
            </div>
          </div>
        </div>

        <div className="homepage-card">
          <h2 className="homepage-card-title">{t('homepage.toolsTitle')}</h2>
          <p className="homepage-card-text">{t('homepage.toolsText')}</p>

          <div className="homepage-tools-buttons">
            <Link to="/GamesHome" className="homepage-tools-btn homepage-tools-btn-primary">
              {t('homepage.toolsGames')}
            </Link>
            <Link to="/ToolsHome" className="homepage-tools-btn homepage-tools-btn-secondary">
              {t('homepage.tools')}
            </Link>
          </div>

          <p className="homepage-card-note">{t('homepage.toolsNote')}</p>
        </div>

        <div className="homepage-card homepage-anchor" id="contact-section">
          <h2 className="homepage-card-title">{t('homepage.contactTitle')}</h2>

          <ul className="homepage-contact-list">
            <li>
              <strong>{t('homepage.contactEmailLabel')}</strong>{' '}
              <a href={`mailto:${t('homepage.contactEmail')}`}>{t('homepage.contactEmail')}</a>
            </li>
            <li>
              <strong>{t('homepage.contactPhoneLabel')}</strong>{' '}
              <a href={`tel:${t('homepage.contactPhone').replace(/-/g, '')}`}>{t('homepage.contactPhone')}</a>
            </li>
            <li>
              <strong>{t('homepage.contactLinkedinLabel')}</strong>{' '}
              <a href="https://www.linkedin.com/in/yehuda-shmulevitz/" target="_blank" rel="noopener noreferrer">
                {t('homepage.contactLinkedinUrl')}
              </a>
            </li>
            <li>
              <strong>{t('homepage.contactGithubLabel')}</strong>{' '}
              <a href="https://github.com/yehuda121?tab=repositories" target="_blank" rel="noopener noreferrer">
                {t('homepage.contactGithubUrl')}
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="social-media-container">
        <a href="https://www.linkedin.com/in/yehuda-shmulevitz/" target="_blank" rel="noopener noreferrer" className="social-media-link">
          <img src="/linkedin.svg" alt={t('homepage.socialLinkedinAlt')} />
        </a>
        <a href="https://github.com/yehuda121?tab=repositories" target="_blank" rel="noopener noreferrer" className="social-media-link">
          <img src="/github.svg" alt={t('homepage.socialGithubAlt')} />
        </a>
        <a href="https://www.facebook.com/yehuda.shmulevitz.1" target="_blank" rel="noopener noreferrer" className="social-media-link">
          <img src="/facebook.svg" alt={t('homepage.socialFacebookAlt')} />
        </a>
      </div>
    </div>
  );
}

export default Homepage;
