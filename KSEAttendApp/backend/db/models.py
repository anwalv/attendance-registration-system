import enum
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, String, UniqueConstraint
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class GlobalRole(str, enum.Enum):
    admin = "admin"
    user = "user"

class CourseRole(str, enum.Enum):
    admin = "admin"
    teacher = "teacher"
    student = "student"


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(255), nullable=False)
    email      = Column(String(255), nullable=False, unique=True)
    global_role = Column(Enum(GlobalRole), nullable=False, default=GlobalRole.user)
    active     = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    course_memberships = relationship("CourseMember", back_populates="user",   cascade="all, delete-orphan")
    attendances        = relationship("Attendance",   back_populates="student", cascade="all, delete-orphan")
    achievements       = relationship("Achievement",  back_populates="student", cascade="all, delete-orphan")


class CourseMember(Base):
    __tablename__ = "course_members"
    __table_args__ = (UniqueConstraint("course_id", "user_id"),)

    id        = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    user_id   = Column(Integer, ForeignKey("users.id",   ondelete="CASCADE"), nullable=False)
    course_role = Column(Enum(CourseRole), nullable=False)

    course = relationship("Course", back_populates="members")
    user   = relationship("User",   back_populates="course_memberships")