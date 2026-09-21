from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship, declarative_base
import datetime

Base = declarative_base()

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    children = relationship("Folder", backref="parent", remote_side=[id])
    files = relationship("File", back_populates="folder")


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    filename = Column(String, index=True, nullable=False)
    file_size = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    folder = relationship("Folder", back_populates="files")
    parts = relationship("FilePart", back_populates="file", cascade="all, delete-orphan")


class FilePart(Base):
    __tablename__ = "file_parts"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    telegram_message_id = Column(Integer, nullable=False)
    part_number = Column(Integer, nullable=False)

    # Relationships
    file = relationship("File", back_populates="parts")


class TransferJob(Base):
    __tablename__ = "transfer_jobs"

    id = Column(String, primary_key=True, index=True)  # UUID
    job_type = Column(String, nullable=False)  # 'drive_to_telegram' | 'telegram_to_drive'
    status = Column(String, default="pending", index=True)  # 'pending', 'connecting', 'mounting', 'transferring', 'merging', 'completed', 'failed', 'cancelled'
    source_name = Column(String, nullable=False)
    source_path = Column(String, nullable=True)
    destination_folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    destination_drive_path = Column(String, nullable=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=True)
    total_bytes = Column(Integer, default=0)
    transferred_bytes = Column(Integer, default=0)
    current_part = Column(Integer, default=0)
    total_parts = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

