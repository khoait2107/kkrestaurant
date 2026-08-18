import os
from waitress import serve
from app import app

if __name__ == "__main__":
    host=os.getenv("WAITRESS_HOST","127.0.0.1")
    port=int(os.getenv("WAITRESS_PORT","5000"))
    threads=int(os.getenv("WAITRESS_THREADS","8"))
    serve(app, host=host, port=port, threads=threads)
