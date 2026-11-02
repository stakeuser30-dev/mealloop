from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, JSON
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, nullable=False) # 'STUDENT' | 'CANTEEN_STAFF' | 'ADMIN' | 'NGO'
    student_id = Column(String, nullable=True)
    hostel = Column(String, nullable=True)
    canteen_id = Column(String, nullable=True)
    organization_name = Column(String, nullable=True)
    has_active_membership = Column(Boolean, default=False)
    membership_expiry = Column(DateTime, nullable=True)
    membership_savings_paise = Column(Integer, default=0)
    referral_code = Column(String, unique=True, nullable=False)
    referral_credits_paise = Column(Integer, default=0)
    phone = Column(String, nullable=True)


class Canteen(Base):
    __tablename__ = "canteens"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    campus = Column(String, nullable=False)
    location_desc = Column(Text, nullable=False)
    opening_hours = Column(String, nullable=False)
    pickup_slots = Column(JSON, nullable=False)
    contact_number = Column(String, nullable=False)
    is_open = Column(Boolean, default=True)


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(String, primary_key=True, index=True)
    canteen_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price_paise = Column(Integer, nullable=False)
    is_veg = Column(Boolean, default=True)
    description = Column(Text, nullable=False)
    ingredients = Column(JSON, nullable=False)
    allergens = Column(JSON, nullable=False)
    stock_available = Column(Integer, default=20)
    image_emoji = Column(String, default="🍱")
    prep_time_mins = Column(Integer, default=8)
    customisations = Column(JSON, nullable=True)
    is_featured = Column(Boolean, default=False)


class GroupDeal(Base):
    __tablename__ = "group_deals"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    food_item_id = Column(String, nullable=False)
    food_item_name = Column(String, nullable=False)
    regular_price_paise = Column(Integer, nullable=False)
    group_price_paise = Column(Integer, nullable=False)
    current_participants = Column(Integer, default=0)
    target_participants = Column(Integer, default=8)
    status = Column(String, default="ACTIVE") # 'ACTIVE' | 'UNLOCKED' | 'EXPIRED' | 'COMPLETED'
    expires_at = Column(DateTime, nullable=False)
    participant_ids = Column(JSON, default=list)
    pickup_slot = Column(String, nullable=False)
    canteen_name = Column(String, nullable=False)
    image_emoji = Column(String, default="🥘")


class RescueMealBatch(Base):
    __tablename__ = "rescue_meal_batches"

    id = Column(String, primary_key=True, index=True)
    food_item_id = Column(String, nullable=False)
    food_item_name = Column(String, nullable=False)
    original_price_paise = Column(Integer, nullable=False)
    quantity_available = Column(Integer, default=10)
    reason = Column(Text, nullable=False)
    prepared_at = Column(DateTime, default=datetime.utcnow)
    offer_started_at = Column(DateTime, default=datetime.utcnow)
    sale_cutoff = Column(String, nullable=False)
    handover_cutoff = Column(String, nullable=False)
    handling_info = Column(Text, nullable=False)
    allergens = Column(JSON, default=list)
    base_discount_percent = Column(Integer, default=15)
    current_discount_percent = Column(Integer, default=15)
    current_price_paise = Column(Integer, nullable=False)
    ngo_notified = Column(Boolean, default=False)
    status = Column(String, default="AVAILABLE") # 'AVAILABLE' | 'SOLD_OUT' | 'OFFERED_TO_NGO' | 'DONATED' | 'DISCARDED'
    image_emoji = Column(String, default="🍱")
    canteen_name = Column(String, nullable=False)


class DonationOffer(Base):
    __tablename__ = "donation_offers"

    id = Column(String, primary_key=True, index=True)
    rescue_batch_id = Column(String, nullable=False)
    canteen_name = Column(String, nullable=False)
    food_item_name = Column(String, nullable=False)
    portions = Column(Integer, nullable=False)
    handling_info = Column(Text, nullable=False)
    location = Column(String, nullable=False)
    pickup_cutoff = Column(String, nullable=False)
    status = Column(String, default="PENDING_NGO") # 'PENDING_NGO' | 'ACCEPTED' | 'DECLINED' | 'HANDED_OVER' | 'EXPIRED'
    ngo_org_name = Column(String, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    handed_over_at = Column(DateTime, nullable=True)
    verified_by_staff = Column(String, nullable=True)
    image_emoji = Column(String, default="🍲")


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, nullable=False)
    user_name = Column(String, nullable=False)
    user_email = Column(String, nullable=False)
    canteen_id = Column(String, nullable=False)
    canteen_name = Column(String, nullable=False)
    pickup_counter = Column(String, default="Counter 2 (Student Pickup)")
    items = Column(JSON, nullable=False)
    pickup_slot = Column(String, nullable=False)
    item_total_paise = Column(Integer, nullable=False)
    discount_paise = Column(Integer, default=0)
    coupon_code = Column(String, nullable=True)
    applied_coupon_discount_paise = Column(Integer, default=0)
    membership_discount_paise = Column(Integer, default=0)
    referral_discount_paise = Column(Integer, default=0)
    taxes_paise = Column(Integer, default=0)
    payable_amount_paise = Column(Integer, nullable=False)
    payment_status = Column(String, default="PAID")
    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    pickup_token = Column(String, unique=True, index=True, nullable=False)
    pickup_qr_data = Column(Text, nullable=False)
    pickup_qr_url = Column(Text, nullable=True)
    collection_status = Column(String, default="READY_FOR_PICKUP") # 'READY_FOR_PICKUP' | 'COLLECTED'
    collected_at = Column(DateTime, nullable=True)
    collected_by_staff = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    pickup_notes = Column(Text, nullable=True)


class PartyPreorder(Base):
    __tablename__ = "party_preorders"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, nullable=False)
    student_name = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)
    event_title = Column(String, nullable=False)
    event_date = Column(String, nullable=False)
    pickup_time = Column(String, nullable=False)
    head_count = Column(Integer, nullable=False)
    items_requested = Column(JSON, nullable=False)
    special_instructions = Column(Text, nullable=True)
    status = Column(String, default="PENDING_REVIEW")
    quoted_price_paise = Column(Integer, nullable=True)
    canteen_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    actor_role = Column(String, nullable=False)
    actor_name = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=False)
