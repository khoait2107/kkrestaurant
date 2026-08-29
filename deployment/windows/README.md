# Windows Server production

1. Install Python 3.11/3.12.
2. Create a venv and install requirements.
3. Keep `.env` outside source control.
4. Run `python run_waitress.py`.
5. Put IIS/Apache/Nginx in front of Waitress for HTTPS and reverse proxy.
6. Set in `.env`:
   TRUST_PROXY=1
   FORCE_HTTPS=1
   HSTS_ENABLED=1
   CSP_ENABLED=1
   SESSION_COOKIE_SECURE=1
