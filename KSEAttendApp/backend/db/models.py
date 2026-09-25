import enum
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, Numeric, String, UniqueConstraint, create_engine
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


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent  = "absent"
    excused = "excused"


class RuleType(str, enum.Enum):
    minimum_percentage = "minimum_percentage"
    bonus_points       = "bonus_points"


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


class Course(Base):
    __tablename__ = "courses"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(255), nullable=False)
    term       = Column(String(64))
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    members         = relationship("CourseMember",    back_populates="course",  cascade="all, delete-orphan")
    schedule_series = relationship("ScheduleSeries",  back_populates="course",  cascade="all, delete-orphan")
    events          = relationship("Event",           back_populates="course",  cascade="all, delete-orphan")
    rules           = relationship("Rule",            back_populates="course",  cascade="all, delete-orphan")


class CourseMember(Base):
    __tablename__ = "course_members"
    __table_args__ = (UniqueConstraint("course_id", "user_id"),)

    id        = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    user_id   = Column(Integer, ForeignKey("users.id",   ondelete="CASCADE"), nullable=False)
    course_role = Column(Enum(CourseRole), nullable=False)

    course = relationship("Course", back_populates="members")
    user   = relationship("User",   back_populates="course_memberships")


class ScheduleSeries(Base):
    __tablename__ = "schedule_series"

    id               = Column(Integer, primary_key=True)
    course_id        = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title            = Column(String(255), nullable=False)
    rrule            = Column(String(512))
    duration_minutes = Column(Integer, nullable=False)
    created_at       = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    course = relationship("Course", back_populates="schedule_series")
    events = relationship("Event",  back_populates="series")


class Event(Base):
    __tablename__ = "events"

    id             = Column(Integer, primary_key=True)
    course_id      = Column(Integer, ForeignKey("courses.id",          ondelete="CASCADE"),  nullable=False)
    series_id      = Column(Integer, ForeignKey("schedule_series.id",  ondelete="SET NULL"), nullable=True)
    title          = Column(String(255), nullable=False)
    event_type     = Column(String(50), nullable=False, default='Лекція')
    start_datetime = Column(DateTime(timezone=True), nullable=False)
    end_datetime   = Column(DateTime(timezone=True), nullable=False)
    created_at     = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    course      = relationship("Course",         back_populates="events")
    series      = relationship("ScheduleSeries", back_populates="events")
    qr_session  = relationship("QRSession",      back_populates="event",      uselist=False, cascade="all, delete-orphan")
    attendances = relationship("Attendance",     back_populates="event",      cascade="all, delete-orphan")


class QRSession(Base):
    __tablename__ = "qr_sessions"
    __table_args__ = (UniqueConstraint("event_id"),)

    id         = Column(Integer, primary_key=True)
    event_id   = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    session_secret = Column(String(64), nullable=False)
    ttl_seconds = Column(Integer, nullable=False, default=10)
    active     = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    event = relationship("Event", back_populates="qr_session")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("event_id", "student_id"),)

    id         = Column(Integer, primary_key=True)
    event_id   = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id",  ondelete="CASCADE"), nullable=False)
    status     = Column(Enum(AttendanceStatus), nullable=False, default=AttendanceStatus.absent)
    checked_at = Column(DateTime(timezone=True))

    event   = relationship("Event", back_populates="attendances")
    student = relationship("User",  back_populates="attendances")


class Rule(Base):
    __tablename__ = "rules"

    id         = Column(Integer, primary_key=True)
    course_id  = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(255), nullable=False)
    type       = Column(Enum(RuleType), nullable=False)
    value      = Column(Numeric(5, 2), nullable=False)  # напр. 80.00 (%)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    course       = relationship("Course",      back_populates="rules")
    achievements = relationship("Achievement", back_populates="rule", cascade="all, delete-orphan")


class Achievement(Base):
    __tablename__ = "achievements"
    __table_args__ = (UniqueConstraint("student_id", "rule_id"),)

    id         = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("users.id",  ondelete="CASCADE"), nullable=False)
    rule_id    = Column(Integer, ForeignKey("rules.id",  ondelete="CASCADE"), nullable=False)
    earned_at  = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    student = relationship("User", back_populates="achievements")
    rule    = relationship("Rule", back_populates="achievements")


if __name__ == "__main__":
    DATABASE_URL = "postgresql://attendance_user:password@localhost:5433/attendance_db"
    engine = create_engine(DATABASE_URL, echo=True)
    Base.metadata.create_all(engine)
    print("Всі таблиці створено")
