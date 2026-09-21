import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.models import Base

# Determine database path
data_dir = os.environ.get("UNLIM_CLOUT_DATA_DIR")
if data_dir:
    os.makedirs(data_dir, exist_ok=True)
    DB_PATH = os.path.join(data_dir, "cloud_storage.db")
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cloud_storage.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# Connect args required for SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
