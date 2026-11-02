"""
Standalone database seeding script for MealLoop FastAPI backend.
Usage:
    python seed.py
"""
import sys
from database import engine, Base, SessionLocal
from main import seed_initial_data_if_empty
import models

def seed():
    print("Initializing MealLoop database schema...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Checking and seeding initial records...")
        seed_initial_data_if_empty(db)
        user_count = db.query(models.User).count()
        item_count = db.query(models.FoodItem).count()
        order_count = db.query(models.Order).count()
        print(f"Database successfully ready! Users: {user_count}, Food Items: {item_count}, Orders: {order_count}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
