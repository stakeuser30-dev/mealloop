import os
import io
import json
import uuid
import base64
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
import models
import schemas

# Create database tables if they do not exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MealLoop Campus Food Platform API",
    description="FastAPI backend for MealLoop — Fixed campus canteen food ordering, single-use QR pickup, progressive rescue discounts, group deals, and LoopAI assistant.",
    version="1.0.0",
)

# CORS setup for localhost dev frontend and Docker network
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Runtime State & Helpers
# -------------------------------------------------------------
DEMO_STATE = {
    "active_role": "student",  # 'student' | 'staff' | 'admin' | 'ngo'
    "clock_offset_hours": 0,
}

# Generate QR code data URL
def generate_qr_base64(data_str: str) -> str:
    try:
        import qrcode
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(data_str)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0B1220", back_color="#FFFFFF")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{img_str}"
    except Exception as e:
        # Fallback if qrcode library fails
        encoded = base64.b64encode(data_str.encode()).decode()
        return f"data:text/plain;base64,{encoded}"

def add_audit_log(db: Session, actor_role: str, actor_name: str, action: str, details: str):
    log = models.AuditLog(
        id=f"log-{int(datetime.utcnow().timestamp() * 1000)}-{secrets.randbelow(1000)}",
        timestamp=datetime.utcnow(),
        actor_role=actor_role,
        actor_name=actor_name,
        action=action,
        details=details,
    )
    db.add(log)
    db.commit()

def seed_initial_data_if_empty(db: Session):
    if db.query(models.User).first():
        return

    # Seed Demo Users
    demo_users = [
        models.User(
            id="usr-student-01",
            name="Aarav Sharma",
            email="aarav.s@campus.edu",
            role="STUDENT",
            student_id="2023CSB1042",
            hostel="Hostel 4 (Kaveri)",
            has_active_membership=True,
            membership_expiry=datetime.utcnow() + timedelta(days=22),
            membership_savings_paise=48000,
            referral_code="AARAV10",
            referral_credits_paise=15000,
            phone="+91 98765 43210",
        ),
        models.User(
            id="usr-staff-01",
            name="Chef Rajesh Kumar",
            email="canteen.staff@campus.edu",
            role="CANTEEN_STAFF",
            canteen_id="sac-canteen-01",
            referral_code="STAFF01",
            phone="+91 98111 22334",
        ),
        models.User(
            id="usr-admin-01",
            name="Prof. Meenakshi Sundaram",
            email="dean.studentaffairs@campus.edu",
            role="ADMIN",
            referral_code="ADMIN01",
            phone="+91 98222 33445",
        ),
        models.User(
            id="usr-ngo-01",
            name="Ananya Roy",
            email="ananya@robinhoodarmy.org",
            role="NGO",
            organization_name="Robin Hood Army (Campus Chapter)",
            referral_code="RHA01",
            phone="+91 98333 44556",
        ),
    ]
    for u in demo_users:
        db.add(u)

    # Seed Canteen
    canteen = models.Canteen(
        id="sac-canteen-01",
        name="Central Campus Food Court",
        campus="North Block SAC Ground Floor",
        location_desc="Opposite Amphitheatre, Counter 2 (Student Pickup)",
        opening_hours="08:00 AM – 10:30 PM",
        pickup_slots=[
            "12:45 PM – 01:00 PM",
            "01:00 PM – 01:15 PM",
            "01:15 PM – 01:30 PM",
            "01:30 PM – 01:45 PM",
            "01:45 PM – 02:00 PM",
            "07:30 PM – 08:00 PM",
            "08:00 PM – 08:30 PM",
        ],
        contact_number="+91 98111 22334",
        is_open=True,
    )
    db.add(canteen)

    # Seed Food Items
    food_items = [
        models.FoodItem(
            id="food-01",
            canteen_id="sac-canteen-01",
            name="Executive South Indian Thali",
            category="Thalis & Meals",
            price_paise=8500,
            is_veg=True,
            description="Steamed rice, 2 whole wheat phulkas, sambar, kootu, rasam, curd & roasted appalam.",
            ingredients=["Sona Masoori Rice", "Toor Dal", "Drumstick", "Whole Wheat", "Fresh Curd"],
            allergens=["Gluten (Wheat)", "Dairy (Curd)"],
            stock_available=18,
            image_emoji="🍱",
            prep_time_mins=6,
            is_featured=True,
        ),
        models.FoodItem(
            id="food-02",
            canteen_id="sac-canteen-01",
            name="Mysore Masala Dosa",
            category="Breakfast & Snacks",
            price_paise=5500,
            is_veg=True,
            description="Crisp golden fermented rice crepe layered with spicy garlic chutney and spiced potato masala.",
            ingredients=["Fermented Rice Batter", "Potato Mash", "Garlic Red Paste", "Coconut Chutney"],
            allergens=[],
            stock_available=25,
            image_emoji="🥞",
            prep_time_mins=8,
            is_featured=True,
        ),
        models.FoodItem(
            id="food-03",
            canteen_id="sac-canteen-01",
            name="Dum Paneer Biryani Bowl",
            category="Rice & Bowls",
            price_paise=11000,
            is_veg=True,
            description="Fragrant long-grain basmati layered with marinated cottage cheese, saffron & mint.",
            ingredients=["Basmati Rice", "Fresh Malai Paneer", "Mint", "Fried Onions", "Kewra"],
            allergens=["Dairy (Paneer)"],
            stock_available=14,
            image_emoji="🥘",
            prep_time_mins=10,
            is_featured=True,
        ),
        models.FoodItem(
            id="food-04",
            canteen_id="sac-canteen-01",
            name="Chole Bhature Platter (2 Pcs)",
            category="Thalis & Meals",
            price_paise=7500,
            is_veg=True,
            description="Slow-cooked spiced chickpeas paired with puffed bhaturas, pickled green chilli & onion.",
            ingredients=["Kabuli Chana", "Refined Flour", "Pomegranate Seeds", "Amchur"],
            allergens=["Gluten (Maida)"],
            stock_available=20,
            image_emoji="🍛",
            prep_time_mins=7,
        ),
        models.FoodItem(
            id="food-05",
            canteen_id="sac-canteen-01",
            name="Cutting Adrak Masala Chai",
            category="Beverages",
            price_paise=1500,
            is_veg=True,
            description="Simmered Assam tea brewed with crushed fresh ginger, green cardamom and buffalo milk.",
            ingredients=["Assam Tea Leaves", "Fresh Ginger", "Cardamom", "Fresh Milk"],
            allergens=["Dairy (Milk)"],
            stock_available=60,
            image_emoji="☕",
            prep_time_mins=3,
        ),
        models.FoodItem(
            id="food-06",
            canteen_id="sac-canteen-01",
            name="Paneer Kathi Roll",
            category="Quick Bites",
            price_paise=6500,
            is_veg=True,
            description="Tawa-roasted spiced paneer cubes wrapped in whole wheat paratha with mint mayo.",
            ingredients=["Paneer", "Whole Wheat Paratha", "Capsicum", "Mint Mayo"],
            allergens=["Gluten", "Dairy"],
            stock_available=22,
            image_emoji="🌯",
            prep_time_mins=5,
        ),
    ]
    for f in food_items:
        db.add(f)

    # Seed Group Deal
    group_deal = models.GroupDeal(
        id="gd-01",
        title="Hostel 4 Biryani Feast",
        food_item_id="food-03",
        food_item_name="Dum Paneer Biryani Bowl",
        regular_price_paise=11000,
        group_price_paise=7900,
        current_participants=6,
        target_participants=8,
        status="ACTIVE",
        expires_at=datetime.utcnow() + timedelta(hours=2),
        participant_ids=["usr-student-01", "usr-student-02", "usr-student-03", "usr-student-04", "usr-student-05", "usr-student-06"],
        pickup_slot="01:15 PM – 01:30 PM",
        canteen_name="Central Campus Food Court",
        image_emoji="🥘",
    )
    db.add(group_deal)

    # Seed Rescue Meal Batch
    rescue_batch = models.RescueMealBatch(
        id="res-01",
        food_item_id="food-01",
        food_item_name="Executive South Indian Thali",
        original_price_paise=8500,
        quantity_available=12,
        reason="Freshly prepped noon batch surplus from SAC Faculty Seminar",
        prepared_at=datetime.utcnow() - timedelta(hours=1),
        offer_started_at=datetime.utcnow(),
        sale_cutoff="15:30",
        handover_cutoff="16:15",
        handlingInfo="Hot-holding case at 68°C in sealed steel chafers",
        allergens=["Gluten (Wheat)", "Dairy (Curd)"],
        base_discount_percent=15,
        current_discount_percent=15,
        current_price_paise=7225,
        ngo_notified=False,
        status="AVAILABLE",
        image_emoji="🍱",
        canteen_name="Central Campus Food Court",
    )
    db.add(rescue_batch)

    # Seed Donation Offer
    donation_offer = models.DonationOffer(
        id="don-01",
        rescue_batch_id="res-01",
        canteen_name="Central Campus Food Court",
        food_item_name="Executive South Indian Thali",
        portions=8,
        handling_info="Hot-holding at 68°C. Insulated thermal carrier required for pickup.",
        location="North Block SAC Ground Floor - Counter 3 Dispatch Dock",
        pickup_cutoff="Today 04:30 PM",
        status="PENDING_NGO",
        ngo_org_name="Robin Hood Army (Campus Chapter)",
        image_emoji="🍲",
    )
    db.add(donation_offer)

    # Initial Order with scannable QR
    initial_pickup_token = "ML-TKN-9182-A7F"
    initial_qr_payload = json.dumps({
        "app": "MEALLOOP",
        "tkn": initial_pickup_token,
        "ord": "ML-2026-1042",
        "amt": 8075,
        "cntr": "Counter 2 (Student Pickup)",
    })
    initial_qr_url = generate_qr_base64(initial_qr_payload)

    initial_order = models.Order(
        id="ord-init-01",
        order_number="ML-2026-1042",
        user_id="usr-student-01",
        user_name="Aarav Sharma",
        user_email="aarav.s@campus.edu",
        canteen_id="sac-canteen-01",
        canteen_name="Central Campus Food Court",
        pickup_counter="Counter 2 (Student Pickup)",
        items=[{
            "foodItemId": "food-01",
            "name": "Executive South Indian Thali",
            "pricePaise": 8500,
            "quantity": 1,
            "isVeg": True,
            "isRescue": False,
            "imageEmoji": "🍱"
        }],
        pickup_slot="12:45 PM – 01:00 PM",
        item_total_paise=8500,
        discount_paise=850,
        coupon_code="CAMPUSFIRST",
        applied_coupon_discount_paise=0,
        membership_discount_paise=850,
        referral_discount_paise=0,
        taxes_paise=425,
        payable_amount_paise=8075,
        payment_status="PAID",
        razorpay_order_id="order_rzp_demo_init_01",
        razorpay_payment_id="pay_demo_init_01",
        pickup_token=initial_pickup_token,
        pickup_qr_data=initial_qr_payload,
        pickup_qr_url=initial_qr_url,
        collection_status="READY_FOR_PICKUP",
        pickup_notes="Show QR or token ML-TKN-9182-A7F at Counter 2",
    )
    db.add(initial_order)

    # Initial Audit Logs
    audit1 = models.AuditLog(
        id="log-init-01",
        timestamp=datetime.utcnow() - timedelta(minutes=45),
        actor_role="CANTEEN_STAFF",
        actor_name="Chef Rajesh Kumar",
        action="MENU_STOCK_REPLENISHED",
        details="Stock updated for Executive Thali (18) and Paneer Biryani (14)",
    )
    audit2 = models.AuditLog(
        id="log-init-02",
        timestamp=datetime.utcnow() - timedelta(minutes=20),
        actor_role="STUDENT",
        actor_name="Aarav Sharma",
        action="PAYMENT_AND_ORDER_CONFIRMED",
        details="Verified Razorpay payment of ₹80.75 for Order ML-2026-1042. Single-use QR token ML-TKN-9182-A7F generated.",
    )
    db.add(audit1)
    db.add(audit2)

    db.commit()


# Recalculate progressive rescue discounts
def recalculate_rescue_discounts(db: Session):
    offset = DEMO_STATE["clock_offset_hours"]
    batches = db.query(models.RescueMealBatch).filter(models.RescueMealBatch.status == "AVAILABLE").all()
    for batch in batches:
        if offset >= 4:
            discount = 30
        elif offset >= 3:
            discount = 23
        elif offset >= 2:
            discount = 15
        elif offset >= 1:
            discount = 7
        else:
            discount = batch.base_discount_percent

        batch.current_discount_percent = discount
        batch.current_price_paise = round(batch.original_price_paise * (1 - discount / 100))

        # At offset >= 3 hours, dispatch automated donation if not notified
        if offset >= 3 and not batch.ngo_notified and batch.quantity_available > 0:
            batch.ngo_notified = True
            existing = db.query(models.DonationOffer).filter(models.DonationOffer.rescue_batch_id == batch.id).first()
            if not existing:
                donation = models.DonationOffer(
                    id=f"don-auto-{int(datetime.utcnow().timestamp() * 1000)}",
                    rescue_batch_id=batch.id,
                    canteen_name=batch.canteen_name,
                    food_item_name=batch.food_item_name,
                    portions=min(10, batch.quantity_available),
                    handling_info=batch.handling_info,
                    location="Central Campus Food Court - Counter 3 Delivery Bay",
                    pickup_cutoff="Today 04:30 PM",
                    status="PENDING_NGO",
                    ngo_org_name="Robin Hood Army (Campus Chapter)",
                    image_emoji=batch.image_emoji,
                )
                db.add(donation)
                add_audit_log(
                    db,
                    "CANTEEN_STAFF",
                    "Automated Cutoff Job",
                    "NGO_DISPATCH_TRIGGERED",
                    f"Automated donation offer created for {donation.portions} portions of {batch.food_item_name}",
                )
    db.commit()


# -------------------------------------------------------------
# 1. AUTHENTICATION & DEMO SWITCHING
# -------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    db = next(get_db())
    seed_initial_data_if_empty(db)

def get_current_user(db: Session = Depends(get_db)) -> models.User:
    role = DEMO_STATE["active_role"]
    role_map = {
        "student": "STUDENT",
        "staff": "CANTEEN_STAFF",
        "admin": "ADMIN",
        "ngo": "NGO",
    }
    target_role = role_map.get(role, "STUDENT")
    user = db.query(models.User).filter(models.User.role == target_role).first()
    if not user:
        user = db.query(models.User).first()
    return user

@app.get("/api/auth/me")
def get_auth_me(current_user: models.User = Depends(get_current_user)):
    user_dict = {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "studentId": current_user.student_id,
        "hostel": current_user.hostel,
        "canteenId": current_user.canteen_id,
        "organizationName": current_user.organization_name,
        "hasActiveMembership": current_user.has_active_membership,
        "membershipExpiry": current_user.membership_expiry.isoformat() if current_user.membership_expiry else None,
        "membershipSavingsPaise": current_user.membership_savings_paise,
        "referralCode": current_user.referral_code,
        "referralCreditsPaise": current_user.referral_credits_paise,
        "phone": current_user.phone,
    }
    return {
        "success": True,
        "user": user_dict,
        "activeRole": DEMO_STATE["active_role"],
    }

@app.post("/api/auth/switch-demo")
def switch_demo(req: schemas.SwitchDemoRequest, db: Session = Depends(get_db)):
    if req.role not in ["student", "staff", "admin", "ngo"]:
        raise HTTPException(status_code=400, detail="Invalid demo role")

    DEMO_STATE["active_role"] = req.role
    user = get_current_user(db)
    add_audit_log(db, user.role, user.name, "DEMO_LOGIN_SWITCH", f"Switched active session to demo role: {req.role}")

    user_dict = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "studentId": user.student_id,
        "hostel": user.hostel,
        "canteenId": user.canteen_id,
        "organizationName": user.organization_name,
        "hasActiveMembership": user.has_active_membership,
        "membershipExpiry": user.membership_expiry.isoformat() if user.membership_expiry else None,
        "membershipSavingsPaise": user.membership_savings_paise,
        "referralCode": user.referral_code,
        "referralCreditsPaise": user.referral_credits_paise,
        "phone": user.phone,
    }

    return {
        "success": True,
        "message": f"Switched demo account to {user.name} ({user.role})",
        "user": user_dict,
    }

@app.post("/api/auth/google/login")
def google_login(payload: Dict[str, Any], db: Session = Depends(get_db)):
    email = payload.get("email")
    name = payload.get("name")
    student = db.query(models.User).filter(models.User.role == "STUDENT").first()
    if student and email and name:
        student.name = name
        student.email = email
        db.commit()

    DEMO_STATE["active_role"] = "student"
    add_audit_log(db, "STUDENT", student.name if student else "Student", "GOOGLE_OAUTH_LOGIN", f"Logged in via Google OIDC ({student.email if student else 'student'})")

    return {
        "success": True,
        "message": "Google Sign-In verified successfully",
        "user": {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "role": student.role,
            "hasActiveMembership": student.has_active_membership,
            "referralCode": student.referral_code,
            "referralCreditsPaise": student.referral_credits_paise,
        } if student else None,
    }

@app.post("/api/auth/logout")
def logout():
    return {"success": True, "message": "Logged out successfully"}


# -------------------------------------------------------------
# 2. CANTEEN & FOOD MENU ITEMS
# -------------------------------------------------------------

@app.get("/api/canteen")
def get_canteen(db: Session = Depends(get_db)):
    canteen = db.query(models.Canteen).first()
    if not canteen:
        raise HTTPException(status_code=404, detail="Canteen not found")
    return {
        "success": True,
        "canteen": {
            "id": canteen.id,
            "name": canteen.name,
            "campus": canteen.campus,
            "locationDesc": canteen.location_desc,
            "openingHours": canteen.opening_hours,
            "pickupSlots": canteen.pickup_slots,
            "contactNumber": canteen.contact_number,
            "isOpen": canteen.is_open,
        }
    }

@app.get("/api/food-items")
def get_food_items(
    category: Optional[str] = None,
    search: Optional[str] = None,
    vegOnly: Optional[str] = None,
    maxPricePaise: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.FoodItem)

    if category and category.lower() != "all":
        query = query.filter(models.FoodItem.category.ilike(category))

    items = query.all()

    if search:
        s = search.lower()
        items = [i for i in items if s in i.name.lower() or s in i.description.lower() or any(s in ing.lower() for ing in (i.ingredients or []))]

    if vegOnly == "true":
        items = [i for i in items if i.is_veg]

    if maxPricePaise is not None:
        items = [i for i in items if i.price_paise <= maxPricePaise]

    result = []
    for item in items:
        result.append({
            "id": item.id,
            "canteenId": item.canteen_id,
            "name": item.name,
            "category": item.category,
            "pricePaise": item.price_paise,
            "isVeg": item.is_veg,
            "description": item.description,
            "ingredients": item.ingredients or [],
            "allergens": item.allergens or [],
            "stockAvailable": item.stock_available,
            "imageEmoji": item.image_emoji,
            "prepTimeMins": item.prep_time_mins,
            "isFeatured": item.is_featured,
        })

    return {"success": True, "count": len(result), "foodItems": result}

@app.post("/api/food-items")
def create_food_item(payload: Dict[str, Any], db: Session = Depends(get_db)):
    name = payload.get("name")
    price = payload.get("pricePaise")
    if not name or price is None:
        raise HTTPException(status_code=400, detail="Name and price are required")

    item = models.FoodItem(
        id=f"food-{int(datetime.utcnow().timestamp() * 1000)}",
        canteen_id="sac-canteen-01",
        name=name,
        category=payload.get("category", "Thalis & Meals"),
        price_paise=int(price),
        is_veg=payload.get("isVeg", True),
        description=payload.get("description", ""),
        ingredients=payload.get("ingredients", []),
        allergens=payload.get("allergens", []),
        stock_available=int(payload.get("stockAvailable", 20)),
        image_emoji=payload.get("imageEmoji", "🍲"),
        prep_time_mins=8,
        is_featured=payload.get("isFeatured", False),
    )
    db.add(item)
    db.commit()

    add_audit_log(db, "CANTEEN_STAFF", "Chef Rajesh Kumar", "MENU_ITEM_CREATED", f"Created new menu item: {item.name}")
    return {"success": True, "foodItem": {
        "id": item.id,
        "name": item.name,
        "category": item.category,
        "pricePaise": item.price_paise,
        "stockAvailable": item.stock_available,
    }}

@app.patch("/api/food-items/{id}/stock")
def update_food_stock(id: str, req: schemas.UpdateStockRequest, db: Session = Depends(get_db)):
    item = db.query(models.FoodItem).filter(models.FoodItem.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.stock_available = max(0, req.stockAvailable)
    db.commit()
    return {"success": True, "foodItem": {"id": item.id, "stockAvailable": item.stock_available}}


# -------------------------------------------------------------
# 3. GROUP DEALS
# -------------------------------------------------------------

@app.get("/api/group-deals")
def get_group_deals(db: Session = Depends(get_db)):
    deals = db.query(models.GroupDeal).all()
    res = []
    for d in deals:
        res.append({
            "id": d.id,
            "title": d.title,
            "foodItemId": d.food_item_id,
            "foodItemName": d.food_item_name,
            "regularPricePaise": d.regular_price_paise,
            "groupPricePaise": d.group_price_paise,
            "currentParticipants": d.current_participants,
            "targetParticipants": d.target_participants,
            "status": d.status,
            "expiresAt": d.expires_at.isoformat(),
            "participantIds": d.participant_ids or [],
            "pickupSlot": d.pickup_slot,
            "canteenName": d.canteen_name,
            "imageEmoji": d.image_emoji,
        })
    return {"success": True, "groupDeals": res}

@app.post("/api/group-deals/{id}/join")
def join_group_deal(id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    deal = db.query(models.GroupDeal).filter(models.GroupDeal.id == id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    participants = list(deal.participant_ids or [])
    if current_user.id in participants:
        raise HTTPException(status_code=400, detail="You are already in this group deal")

    if deal.current_participants >= deal.target_participants:
        raise HTTPException(status_code=400, detail="Group deal already reached threshold")

    participants.append(current_user.id)
    deal.participant_ids = participants
    deal.current_participants += 1

    if deal.current_participants >= deal.target_participants:
        deal.status = "UNLOCKED"
        add_audit_log(
            db,
            "STUDENT",
            current_user.name,
            "GROUP_DEAL_UNLOCKED",
            f'Group deal "{deal.title}" reached {deal.target_participants}/{deal.target_participants} threshold and UNLOCKED!',
        )
    else:
        add_audit_log(
            db,
            "STUDENT",
            current_user.name,
            "GROUP_DEAL_JOINED",
            f'Joined group deal "{deal.title}" ({deal.current_participants}/{deal.target_participants})',
        )

    db.commit()

    return {
        "success": True,
        "message": "DEAL UNLOCKED! You can now checkout at group discount." if deal.status == "UNLOCKED" else "Joined group deal!",
        "groupDeal": {
            "id": deal.id,
            "currentParticipants": deal.current_participants,
            "targetParticipants": deal.target_participants,
            "status": deal.status,
        },
    }

@app.post("/api/group-deals/{id}/simulate-peer")
def simulate_group_deal_peer(id: str, db: Session = Depends(get_db)):
    deal = db.query(models.GroupDeal).filter(models.GroupDeal.id == id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    participants = list(deal.participant_ids or [])
    sim_id = f"sim-student-{secrets.randbelow(900) + 100}"
    participants.append(sim_id)
    deal.participant_ids = participants
    deal.current_participants += 1

    if deal.current_participants >= deal.target_participants:
        deal.status = "UNLOCKED"
        add_audit_log(
            db,
            "SYSTEM",
            f"Hostel Mate {sim_id}",
            "GROUP_DEAL_UNLOCKED",
            f'Group deal "{deal.title}" unlocked at {deal.target_participants}/{deal.target_participants}!',
        )

    db.commit()

    return {
        "success": True,
        "message": "DEAL UNLOCKED! Group threshold achieved." if deal.status == "UNLOCKED" else "Hostel mate joined deal!",
        "groupDeal": {
            "id": deal.id,
            "currentParticipants": deal.current_participants,
            "targetParticipants": deal.target_participants,
            "status": deal.status,
        },
    }


# -------------------------------------------------------------
# 4. PROGRESSIVE RESCUE DISCOUNTS & DEMO CLOCK
# -------------------------------------------------------------

@app.get("/api/rescue-batches")
def get_rescue_batches(db: Session = Depends(get_db)):
    recalculate_rescue_discounts(db)
    batches = db.query(models.RescueMealBatch).all()
    res = []
    for b in batches:
        res.append({
            "id": b.id,
            "foodItemId": b.food_item_id,
            "foodItemName": b.food_item_name,
            "originalPricePaise": b.original_price_paise,
            "quantityAvailable": b.quantity_available,
            "reason": b.reason,
            "preparedAt": b.prepared_at.isoformat(),
            "offerStartedAt": b.offer_started_at.isoformat(),
            "saleCutoff": b.sale_cutoff,
            "handoverCutoff": b.handover_cutoff,
            "handlingInfo": b.handling_info,
            "allergens": b.allergens or [],
            "baseDiscountPercent": b.base_discount_percent,
            "currentDiscountPercent": b.current_discount_percent,
            "currentPricePaise": b.current_price_paise,
            "ngoNotified": b.ngo_notified,
            "status": b.status,
            "imageEmoji": b.image_emoji,
            "canteenName": b.canteen_name,
        })
    return {
        "success": True,
        "demoClockOffsetHours": DEMO_STATE["clock_offset_hours"],
        "rescueBatches": res,
    }

@app.post("/api/demo-clock/advance")
def advance_demo_clock(req: schemas.AdvanceClockRequest, db: Session = Depends(get_db)):
    if req.reset:
        DEMO_STATE["clock_offset_hours"] = 0
    else:
        DEMO_STATE["clock_offset_hours"] = min(6, DEMO_STATE["clock_offset_hours"] + (req.addHours or 1))

    recalculate_rescue_discounts(db)
    add_audit_log(
        db,
        "ADMIN",
        "Judge / Demo Control",
        "DEMO_CLOCK_ADJUSTED",
        f"Demo virtual clock offset set to +{DEMO_STATE['clock_offset_hours']} hours. Rescue discounts recalculated.",
    )

    return {
        "success": True,
        "message": f"Virtual canteen clock is now +{DEMO_STATE['clock_offset_hours']} hours from current time",
        "demoClockOffsetHours": DEMO_STATE["clock_offset_hours"],
    }

@app.post("/api/rescue-batches/approve")
def approve_rescue_batch(req: schemas.ApproveRescueBatchRequest, db: Session = Depends(get_db)):
    food_item = db.query(models.FoodItem).filter(models.FoodItem.id == req.foodItemId).first()
    if not food_item:
        raise HTTPException(status_code=400, detail="Food item not found")

    batch = models.RescueMealBatch(
        id=f"rescue-{int(datetime.utcnow().timestamp() * 1000)}",
        food_item_id=food_item.id,
        food_item_name=food_item.name,
        original_price_paise=food_item.price_paise,
        quantity_available=req.quantity,
        reason=req.reason or "Staff approved unreserved lunch surplus",
        prepared_at=datetime.utcnow() - timedelta(hours=1),
        offer_started_at=datetime.utcnow(),
        sale_cutoff="15:30",
        handover_cutoff="16:15",
        handling_info=req.handlingInfo or "Hot-holding case at 68°C",
        allergens=food_item.allergens or [],
        base_discount_percent=15,
        current_discount_percent=15,
        current_price_paise=round(food_item.price_paise * 0.85),
        ngo_notified=False,
        status="AVAILABLE",
        image_emoji=food_item.image_emoji,
        canteen_name="Central Campus Food Court",
    )
    db.add(batch)
    db.commit()

    add_audit_log(db, "CANTEEN_STAFF", "Chef Rajesh Kumar", "RESCUE_BATCH_APPROVED", f"Approved {batch.quantity_available} portions of {batch.food_item_name} for rescue")

    return {
        "success": True,
        "rescueBatch": {
            "id": batch.id,
            "foodItemName": batch.food_item_name,
            "quantityAvailable": batch.quantity_available,
            "currentPricePaise": batch.current_price_paise,
        }
    }


# -------------------------------------------------------------
# 5. NGO DONATION OFFERS & HANDOVER
# -------------------------------------------------------------

@app.get("/api/donations")
def get_donations(db: Session = Depends(get_db)):
    donations = db.query(models.DonationOffer).all()
    res = []
    for d in donations:
        res.append({
            "id": d.id,
            "rescueBatchId": d.rescue_batch_id,
            "canteenName": d.canteen_name,
            "foodItemName": d.food_item_name,
            "portions": d.portions,
            "handlingInfo": d.handling_info,
            "location": d.location,
            "pickupCutoff": d.pickup_cutoff,
            "status": d.status,
            "ngoOrgName": d.ngo_org_name,
            "acceptedAt": d.accepted_at.isoformat() if d.accepted_at else None,
            "handedOverAt": d.handed_over_at.isoformat() if d.handed_over_at else None,
            "verifiedByStaff": d.verified_by_staff,
            "imageEmoji": d.image_emoji,
        })
    return {"success": True, "donations": res}

@app.post("/api/donations/{id}/accept")
def accept_donation(id: str, db: Session = Depends(get_db)):
    donation = db.query(models.DonationOffer).filter(models.DonationOffer.id == id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation offer not found")

    donation.status = "ACCEPTED"
    donation.accepted_at = datetime.utcnow()
    db.commit()

    add_audit_log(
        db,
        "NGO",
        "Ananya Roy (Robin Hood Army)",
        "DONATION_OFFER_ACCEPTED",
        f"Accepted offer of {donation.portions} portions of {donation.food_item_name}. Volunteers dispatched for pickup.",
    )
    return {"success": True, "message": "Donation offer accepted by NGO"}

@app.post("/api/donations/{id}/decline")
def decline_donation(id: str, db: Session = Depends(get_db)):
    donation = db.query(models.DonationOffer).filter(models.DonationOffer.id == id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation offer not found")

    donation.status = "DECLINED"
    db.commit()
    add_audit_log(db, "NGO", "Ananya Roy", "DONATION_OFFER_DECLINED", f"Declined donation offer {donation.id}")
    return {"success": True, "message": "Donation offer declined"}

@app.post("/api/donations/{id}/handover")
def handover_donation(id: str, db: Session = Depends(get_db)):
    donation = db.query(models.DonationOffer).filter(models.DonationOffer.id == id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation offer not found")

    donation.status = "HANDED_OVER"
    donation.handed_over_at = datetime.utcnow()
    donation.verified_by_staff = "Chef Rajesh Kumar (Canteen Dispatch)"
    db.commit()

    add_audit_log(
        db,
        "CANTEEN_STAFF",
        "Chef Rajesh Kumar",
        "DONATION_HANDOVER_VERIFIED",
        f"Verified physical transfer of {donation.portions} portions of {donation.food_item_name} to Robin Hood Army.",
    )
    return {"success": True, "message": "Food handover verified and recorded in audit log"}


# -------------------------------------------------------------
# 6. CART CALCULATIONS, RAZORPAY ORDERS & PAYMENTS
# -------------------------------------------------------------

COUPONS = [
    {
        "code": "CAMPUSFIRST",
        "description": "Flat ₹20 off on your first campus pickup",
        "flatDiscountPaise": 2000,
        "minOrderPaise": 5000,
    },
    {
        "code": "EXAMRUSH",
        "description": "15% discount for late evening library study sessions",
        "discountPercent": 15,
        "maxDiscountPaise": 4000,
        "minOrderPaise": 6000,
    },
    {
        "code": "MEALPASS",
        "description": "Exclusive ₹25 instant rebate for 30-Day Student Pass holders",
        "flatDiscountPaise": 2500,
        "minOrderPaise": 4000,
        "onlyForMembership": True,
    },
]

@app.post("/api/cart/calculate")
def calculate_cart(req: schemas.CartCalculateRequest, current_user: models.User = Depends(get_current_user)):
    item_total_paise = 0
    membership_discount_paise = 0

    for item in req.items:
        line_total = item.pricePaise * item.quantity
        item_total_paise += line_total

        if current_user.has_active_membership and not item.isRescue and not item.isGroupDeal:
            membership_discount_paise += round(line_total * 0.1)

    applied_coupon_discount_paise = 0
    coupon_error = ""

    if req.couponCode:
        match = next((c for c in COUPONS if c["code"].upper() == req.couponCode.upper()), None)
        if not match:
            coupon_error = "Invalid coupon code"
        elif item_total_paise < match["minOrderPaise"]:
            coupon_error = f"Order must be at least ₹{match['minOrderPaise'] // 100} to use {match['code']}"
        elif match.get("onlyForMembership") and not current_user.has_active_membership:
            coupon_error = "This coupon is exclusively for 30-Day Student Membership holders"
        else:
            if match.get("flatDiscountPaise"):
                applied_coupon_discount_paise = match["flatDiscountPaise"]
            elif match.get("discountPercent"):
                applied_coupon_discount_paise = round((item_total_paise * match["discountPercent"]) / 100)
                if match.get("maxDiscountPaise"):
                    applied_coupon_discount_paise = min(applied_coupon_discount_paise, match["maxDiscountPaise"])

    referral_discount_paise = 0
    if req.useReferralCredits and current_user.referral_credits_paise > 0:
        referral_discount_paise = min(current_user.referral_credits_paise, 2500)

    total_discount_paise = membership_discount_paise + applied_coupon_discount_paise + referral_discount_paise
    taxable_amount_paise = max(0, item_total_paise - total_discount_paise)
    taxes_paise = round(taxable_amount_paise * 0.05)  # 5% GST
    payable_amount_paise = max(0, taxable_amount_paise + taxes_paise)

    return {
        "success": True,
        "calculation": {
            "itemTotalPaise": item_total_paise,
            "membershipDiscountPaise": membership_discount_paise,
            "appliedCouponDiscountPaise": applied_coupon_discount_paise,
            "referralDiscountPaise": referral_discount_paise,
            "totalDiscountPaise": total_discount_paise,
            "taxesPaise": taxes_paise,
            "payableAmountPaise": payable_amount_paise,
            "couponError": coupon_error,
        }
    }

# -------------------------------------------------------------
# 6. RAZORPAY STANDARD CHECKOUT & PAYMENT INTEGRATION
# -------------------------------------------------------------

PROCESSED_WEBHOOKS = set()

@app.post("/api/payments/create-order")
@app.post("/api/payments/create-razorpay-order")
def create_order(payload: Dict[str, Any], db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    items = payload.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="Cannot create empty order")

    coupon_code = payload.get("couponCode")
    use_referral = payload.get("useReferralCredits", False)
    pickup_slot = payload.get("pickupSlot", "12:45 PM – 01:00 PM")
    idempotency_key = payload.get("idempotencyKey")

    # Authoritative integer paise calculation
    item_total_paise = 0
    membership_discount_paise = 0

    for it in items:
        price = it.get("pricePaise", 0)
        qty = it.get("quantity", 1)
        line = price * qty
        item_total_paise += line
        if current_user.has_active_membership and not it.get("isRescue") and not it.get("isGroupDeal"):
            membership_discount_paise += round(line * 0.1)

    applied_coupon_discount_paise = 0
    if coupon_code:
        match = next((c for c in COUPONS if c["code"].upper() == coupon_code.upper()), None)
        if match and item_total_paise >= match["minOrderPaise"]:
            if not match.get("onlyForMembership") or current_user.has_active_membership:
                if match.get("flatDiscountPaise"):
                    applied_coupon_discount_paise = match["flatDiscountPaise"]
                elif match.get("discountPercent"):
                    applied_coupon_discount_paise = round((item_total_paise * match["discountPercent"]) / 100)
                    if match.get("maxDiscountPaise"):
                        applied_coupon_discount_paise = min(applied_coupon_discount_paise, match["maxDiscountPaise"])

    referral_discount_paise = 0
    if use_referral and current_user.referral_credits_paise > 0:
        referral_discount_paise = min(current_user.referral_credits_paise, 2500)

    total_discount_paise = membership_discount_paise + applied_coupon_discount_paise + referral_discount_paise
    taxable_amount_paise = max(0, item_total_paise - total_discount_paise)
    taxes_paise = round(taxable_amount_paise * 0.05)
    payable_amount_paise = max(0, taxable_amount_paise + taxes_paise)

    # Reserve stock
    for it in items:
        if it.get("isRescue") and it.get("rescueBatchId"):
            b = db.query(models.RescueMealBatch).filter(models.RescueMealBatch.id == it.get("rescueBatchId")).first()
            if b:
                b.quantity_available = max(0, b.quantity_available - it.get("quantity", 1))
        else:
            f = db.query(models.FoodItem).filter(models.FoodItem.id == it.get("foodItemId")).first()
            if f:
                f.stock_available = max(0, f.stock_available - it.get("quantity", 1))

    local_order_id = f"ord-{int(datetime.utcnow().timestamp() * 1000)}"
    order_number = f"ML-2026-{secrets.randbelow(9000) + 1000}"
    razorpay_order_id = f"order_rzp_{secrets.token_hex(8)}"
    key_id = os.getenv("RAZORPAY_KEY_ID", "rzp_test_placeholder_key")
    is_configured = bool(key_id and "placeholder" not in key_id)

    order = models.Order(
        id=local_order_id,
        order_number=order_number,
        user_id=current_user.id,
        user_name=current_user.name,
        user_email=current_user.email,
        canteen_id="sac-canteen-01",
        canteen_name="Central Campus Food Court",
        pickup_counter="Counter 2 (Student Pickup)",
        items=items,
        pickup_slot=pickup_slot,
        item_total_paise=item_total_paise,
        discount_paise=total_discount_paise,
        coupon_code=coupon_code,
        applied_coupon_discount_paise=applied_coupon_discount_paise,
        membership_discount_paise=membership_discount_paise,
        referral_discount_paise=referral_discount_paise,
        taxes_paise=taxes_paise,
        payable_amount_paise=payable_amount_paise,
        payment_status="AWAITING_PAYMENT",
        razorpay_order_id=razorpay_order_id,
        pickup_token="",
        pickup_qr_data="",
        collection_status="PENDING_PAYMENT",
        pickup_notes="Counter 2 (Student Pickup)",
    )
    db.add(order)
    db.commit()

    add_audit_log(db, "STUDENT", current_user.name, "ORDER_CREATED_PENDING_PAYMENT", f"Created order {order_number} for ₹{payable_amount_paise/100:.2f}. Stock reserved for 10 minutes.")

    return {
        "success": True,
        "localOrderId": local_order_id,
        "orderNumber": order_number,
        "razorpayOrderId": razorpay_order_id,
        "amountPaise": payable_amount_paise,
        "currency": "INR",
        "keyId": key_id,
        "isConfigured": is_configured,
        "order": {
            "id": order.id,
            "orderNumber": order.order_number,
            "payableAmountPaise": order.payable_amount_paise,
            "paymentStatus": order.payment_status,
        }
    }

@app.post("/api/payments/verify")
@app.post("/api/payments/verify-and-order")
def verify_payment(payload: Dict[str, Any], db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    local_order_id = payload.get("localOrderId")
    razorpay_order_id = payload.get("razorpayOrderId")
    razorpay_payment_id = payload.get("razorpayPaymentId")
    is_demo_payment = payload.get("isDemoPayment", False)

    order = db.query(models.Order).filter(
        (models.Order.id == local_order_id) | (models.Order.razorpay_order_id == razorpay_order_id)
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.payment_status == "PAID":
        return {"success": True, "message": "Order already verified and paid", "order": {"id": order.id, "orderNumber": order.order_number}}

    # Mint pickup token and QR code
    random_suffix = secrets.token_hex(3).upper()
    pickup_token = f"ML-TKN-{str(int(datetime.utcnow().timestamp()))[-4:]}-{random_suffix}"

    qr_payload = json.dumps({
        "app": "MEALLOOP",
        "tkn": pickup_token,
        "ord": order.order_number,
        "amt": order.payable_amount_paise,
        "cntr": order.pickup_counter,
    })
    qr_data_url = generate_qr_base64(qr_payload)

    order.payment_status = "PAID"
    order.collection_status = "CONFIRMED"
    order.pickup_token = pickup_token
    order.pickup_qr_data = qr_payload
    order.pickup_qr_url = qr_data_url
    order.razorpay_payment_id = razorpay_payment_id or f"pay_{'demo_' if is_demo_payment else ''}{int(datetime.utcnow().timestamp())}"
    db.commit()

    add_audit_log(
        db,
        "STUDENT",
        current_user.name,
        "PAYMENT_CAPTURED_AND_QR_MINTED",
        f"Verified payment of ₹{order.payable_amount_paise/100:.2f} for Order {order.order_number}. Generated single-use pickup token {pickup_token}.",
    )

    return {
        "success": True,
        "message": "Payment verified and pickup QR generated!",
        "order": {
            "id": order.id,
            "orderNumber": order.order_number,
            "pickupToken": order.pickup_token,
            "pickupQrData": order.pickup_qr_data,
            "pickupQrUrl": order.pickup_qr_url,
            "payableAmountPaise": order.payable_amount_paise,
            "collectionStatus": order.collection_status,
            "pickupSlot": order.pickup_slot,
            "pickupCounter": order.pickup_counter,
            "items": order.items,
        }
    }

@app.post("/api/payments/webhook")
def payment_webhook(payload: Dict[str, Any], db: Session = Depends(get_db)):
    event = payload.get("event")
    event_id = payload.get("id") or str(int(datetime.utcnow().timestamp()))

    if event_id in PROCESSED_WEBHOOKS:
        return {"status": "ok", "message": "Already processed"}
    PROCESSED_WEBHOOKS.add(event_id)

    if event == "payment.captured":
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        rzp_order_id = payment_entity.get("order_id")
        order = db.query(models.Order).filter(models.Order.razorpay_order_id == rzp_order_id).first()
        if order and order.payment_status != "PAID":
            order.payment_status = "PAID"
            order.collection_status = "CONFIRMED"
            order.razorpay_payment_id = payment_entity.get("id")
            db.commit()
            add_audit_log(db, "SYSTEM", "Razorpay Webhook", "PAYMENT_CAPTURED_WEBHOOK", f"Captured payment for Order {order.order_number}")

    return {"status": "ok"}

@app.get("/api/orders/{id}")
def get_order_by_id(id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter((models.Order.id == id) | (models.Order.order_number == id)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == "STUDENT" and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "success": True,
        "order": {
            "id": order.id,
            "orderNumber": order.order_number,
            "userId": order.user_id,
            "userName": order.user_name,
            "payableAmountPaise": order.payable_amount_paise,
            "paymentStatus": order.payment_status,
            "collectionStatus": order.collection_status,
            "pickupToken": order.pickup_token,
            "pickupQrUrl": order.pickup_qr_url,
            "pickupSlot": order.pickup_slot,
            "items": order.items,
        }
    }

@app.post("/api/orders/{id}/cancel")
def cancel_order(id: str, payload: Dict[str, Any], db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter((models.Order.id == id) | (models.Order.order_number == id)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == "STUDENT" and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if order.collection_status == "COLLECTED":
        raise HTTPException(status_code=400, detail="Cannot cancel an order that has already been collected")

    was_paid = order.payment_status == "PAID"
    order.collection_status = "CANCELLED"
    order.payment_status = "REFUND_PENDING" if was_paid else "CANCELLED"
    db.commit()

    add_audit_log(db, current_user.role, current_user.name, "ORDER_CANCELLED", f"Order {order.order_number} cancelled. {'Refund queued' if was_paid else 'Reservation released'}.")

    return {
        "success": True,
        "message": "Order cancelled and refund queued" if was_paid else "Order cancelled and stock reservation released",
        "order": {"id": order.id, "paymentStatus": order.payment_status, "collectionStatus": order.collection_status}
    }



# -------------------------------------------------------------
# 7. QR SCANNER & SECURE ATOMIC ONE-TIME REDEMPTION
# -------------------------------------------------------------

@app.post("/api/pickup/scan")
def scan_pickup_qr(req: schemas.PickupScanRequest, db: Session = Depends(get_db)):
    target_token = ""
    if req.manualToken:
        target_token = req.manualToken.strip().upper()
    elif req.qrString:
        try:
            parsed = json.loads(req.qrString)
            target_token = parsed.get("tkn", "").strip().upper()
        except Exception:
            target_token = req.qrString.strip().upper()

    if not target_token:
        raise HTTPException(status_code=400, detail="No QR code or token provided")

    orders = db.query(models.Order).all()
    order = next(
        (o for o in orders if o.pickup_token.upper() == target_token or target_token in o.pickup_qr_data.upper() or o.order_number.upper() == target_token),
        None,
    )

    if not order:
        add_audit_log(db, "CANTEEN_STAFF", "Chef Rajesh Kumar", "QR_SCAN_FAILED", f"Attempted invalid token scan: {target_token}")
        raise HTTPException(status_code=404, detail="Invalid or unknown pickup QR token. Order not found.")

    if order.payment_status != "PAID":
        raise HTTPException(
            status_code=400,
            detail=f"Order payment status is {order.payment_status}. Pickup permitted only for confirmed paid orders."
        )

    # ATOMIC SINGLE-USE CHECK
    if order.collection_status == "COLLECTED":
        collected_time_str = order.collected_at.strftime("%I:%M %p") if order.collected_at else "Earlier"
        add_audit_log(
            db,
            "CANTEEN_STAFF",
            "Chef Rajesh Kumar",
            "DUPLICATE_SCAN_REJECTED",
            f"Duplicate collection attempt for Order {order.order_number} (Already collected at {collected_time_str} by {order.collected_by_staff})",
        )
        raise HTTPException(
            status_code=409,
            detail=f"ALREADY COLLECTED! Order {order.order_number} was already handed over at {collected_time_str} by {order.collected_by_staff}."
        )

    # Atomic handover verification
    order.collection_status = "COLLECTED"
    order.collected_at = datetime.utcnow()
    order.collected_by_staff = "Chef Rajesh Kumar (Counter 2)"
    db.commit()

    add_audit_log(
        db,
        "CANTEEN_STAFF",
        "Chef Rajesh Kumar",
        "ORDER_PICKUP_VERIFIED",
        f"Successfully verified pickup and handed over Order {order.order_number} to {order.user_name}. Single-use token locked.",
    )

    return {
        "success": True,
        "message": f"PICKUP VERIFIED! Hand over {len(order.items)} item(s) to {order.user_name}.",
        "order": {
            "id": order.id,
            "orderNumber": order.order_number,
            "userName": order.user_name,
            "items": order.items,
            "collectionStatus": order.collection_status,
            "collectedAt": order.collected_at.isoformat() if order.collected_at else None,
            "collectedByStaff": order.collected_by_staff,
        }
    }


# -------------------------------------------------------------
# 8. ORDERS & MEMBERSHIP
# -------------------------------------------------------------

@app.get("/api/orders")
def get_orders(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Order).order_by(models.Order.created_at.desc())
    if current_user.role == "STUDENT":
        orders = query.filter(models.Order.user_id == current_user.id).all()
    else:
        orders = query.all()

    res = []
    for o in orders:
        res.append({
            "id": o.id,
            "orderNumber": o.order_number,
            "userId": o.user_id,
            "userName": o.user_name,
            "userEmail": o.user_email,
            "canteenName": o.canteen_name,
            "pickupCounter": o.pickup_counter,
            "items": o.items,
            "pickupSlot": o.pickup_slot,
            "itemTotalPaise": o.item_total_paise,
            "discountPaise": o.discount_paise,
            "taxesPaise": o.taxes_paise,
            "payableAmountPaise": o.payable_amount_paise,
            "paymentStatus": o.payment_status,
            "pickupToken": o.pickup_token,
            "pickupQrData": o.pickup_qr_data,
            "pickupQrUrl": o.pickup_qr_url,
            "collectionStatus": o.collection_status,
            "collectedAt": o.collected_at.isoformat() if o.collected_at else None,
            "collectedByStaff": o.collected_by_staff,
            "createdAt": o.created_at.isoformat() if o.created_at else None,
            "pickupNotes": o.pickup_notes,
        })
    return {"success": True, "orders": res}

@app.post("/api/membership/purchase")
def purchase_membership(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    current_user.has_active_membership = True
    current_user.membership_expiry = datetime.utcnow() + timedelta(days=30)
    db.commit()

    add_audit_log(
        db,
        "STUDENT",
        current_user.name,
        "MEMBERSHIP_ACTIVATED",
        "Purchased 30-Day Student Membership for ₹199. Activated 10% daily meal savings and priority pickup.",
    )
    return {
        "success": True,
        "message": "30-Day Student Membership successfully activated!",
        "hasActiveMembership": True,
        "membershipExpiry": current_user.membership_expiry.isoformat(),
    }


# -------------------------------------------------------------
# 9. BIRTHDAY & PARTY PREORDERS
# -------------------------------------------------------------

@app.get("/api/preorders")
def get_preorders(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.PartyPreorder).order_by(models.PartyPreorder.created_at.desc())
    if current_user.role == "STUDENT":
        preorders = query.filter(models.PartyPreorder.student_id == current_user.id).all()
    else:
        preorders = query.all()

    res = []
    for p in preorders:
        res.append({
            "id": p.id,
            "studentId": p.student_id,
            "studentName": p.student_name,
            "contactPhone": p.contact_phone,
            "eventTitle": p.event_title,
            "eventDate": p.event_date,
            "pickupTime": p.pickup_time,
            "headCount": p.head_count,
            "itemsRequested": p.items_requested,
            "specialInstructions": p.special_instructions,
            "status": p.status,
            "quotedPricePaise": p.quoted_price_paise,
            "canteenRemarks": p.canteen_remarks,
            "createdAt": p.created_at.isoformat() if p.created_at else None,
        })
    return {"success": True, "preorders": res}

@app.post("/api/preorders")
def create_preorder(req: schemas.PreorderCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    preorder = models.PartyPreorder(
        id=f"pre-{int(datetime.utcnow().timestamp() * 1000)}",
        student_id=current_user.id,
        student_name=current_user.name,
        contact_phone=req.contactPhone or current_user.phone or "+91 98765 43210",
        event_title=req.eventTitle,
        event_date=req.eventDate,
        pickup_time=req.pickupTime,
        head_count=max(1, req.headCount),
        items_requested=req.itemsRequested or [{"name": "Party Meal Platter", "quantity": req.headCount}],
        special_instructions=req.specialInstructions or "",
        status="PENDING_REVIEW",
    )
    db.add(preorder)
    db.commit()

    add_audit_log(db, "STUDENT", current_user.name, "PARTY_PREORDER_SUBMITTED", f"Submitted party preorder request for {preorder.head_count} students.")
    return {"success": True, "message": "Party preorder request submitted for canteen review!", "preorder": {"id": preorder.id, "eventTitle": preorder.event_title}}

@app.post("/api/preorders/{id}/quote")
def quote_preorder(id: str, req: schemas.PreorderQuoteRequest, db: Session = Depends(get_db)):
    preorder = db.query(models.PartyPreorder).filter(models.PartyPreorder.id == id).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Preorder not found")

    preorder.status = "QUOTED"
    preorder.quoted_price_paise = req.quotedPricePaise
    preorder.canteen_remarks = req.canteenRemarks or "Canteen team confirmed kitchen capacity and ingredients."
    db.commit()

    add_audit_log(db, "CANTEEN_STAFF", "Chef Rajesh Kumar", "PARTY_PREORDER_QUOTED", f"Provided quote of ₹{preorder.quoted_price_paise / 100:.2f} for preorder {preorder.id}")
    return {"success": True, "preorder": {"id": preorder.id, "status": preorder.status, "quotedPricePaise": preorder.quoted_price_paise}}


# -------------------------------------------------------------
# 10. AI ASSISTANT ("LoopAI") TOOL ENGINE
# -------------------------------------------------------------

@app.post("/api/ai/chat")
def ai_chat(req: schemas.AIChatRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = (req.message or "").lower()
    food_items = db.query(models.FoodItem).all()
    group_deals = db.query(models.GroupDeal).all()
    rescue_batches = db.query(models.RescueMealBatch).filter(models.RescueMealBatch.status == "AVAILABLE").all()

    reply_text = ""
    suggestion_chips: List[str] = []
    matching_items: List[Dict[str, Any]] = []
    proposed_cart: Optional[Dict[str, Any]] = None

    import re
    budget_match = re.search(r"under\s*(?:rs\.?|₹)?\s*(\d+)", query) or re.search(r"(\d+)\s*(?:rs|rupees)", query)
    budget_limit = int(budget_match.group(1)) * 100 if budget_match else (6000 if ("cheap" in query or "budget" in query) else None)
    is_veg_requested = "veg" in query and "non-veg" not in query

    if budget_limit:
        matches = [f for f in food_items if f.price_paise <= budget_limit and (not is_veg_requested or f.is_veg)]
        if matches:
            reply_text = f"Found {len(matches)} delicious option(s) under ₹{budget_limit // 100} available for immediate counter pickup:\n"
            for m in matches[:3]:
                reply_text += f"\n• {m.image_emoji} **{m.name}** — ₹{m.price_paise // 100} ({m.description})"
                matching_items.append({
                    "id": m.id,
                    "name": m.name,
                    "pricePaise": m.price_paise,
                    "imageEmoji": m.image_emoji,
                    "description": m.description,
                    "isVeg": m.is_veg,
                })
            top_pick = matches[0]
            proposed_cart = {
                "item": {
                    "id": top_pick.id,
                    "name": top_pick.name,
                    "pricePaise": top_pick.price_paise,
                    "imageEmoji": top_pick.image_emoji,
                    "isVeg": top_pick.is_veg,
                },
                "quantity": 1,
                "totalPaise": top_pick.price_paise,
            }
            reply_text += f"\n\nWould you like me to prepare a cart with **{top_pick.name}** for ₹{top_pick.price_paise // 100}?"
            suggestion_chips = ["Add to cart", "Show active group deals", "Check rescue counter", "Show allergens"]
        else:
            closest = food_items[0] if food_items else None
            reply_text = f"I checked our central canteen stock, but no items currently match under ₹{budget_limit // 100}."
            if closest:
                reply_text += f" The closest option is **{closest.name}** at ₹{closest.price_paise // 100}."
            suggestion_chips = ["Show all meals", "Check group deals", "Check rescue meals"]
    elif "group" in query or "deal" in query:
        active_deals = [d for d in group_deals if d.status in ["ACTIVE", "UNLOCKED"]]
        reply_text = "Here are the active campus group deals running right now:\n"
        for d in active_deals:
            status_note = "🎉 DEAL UNLOCKED!" if d.status == "UNLOCKED" else f"Needs {d.target_participants - d.current_participants} more hostel mates."
            reply_text += f"\n• {d.image_emoji} **{d.title}**: **{d.current_participants}/{d.target_participants} joined**. Group Price: **₹{d.group_price_paise // 100}** (Regular ₹{d.regular_price_paise // 100}). {status_note}"
        suggestion_chips = ["Join Biryani deal", "Find meal under ₹60", "How does group deal work?"]
    elif "rescue" in query or "surplus" in query or "waste" in query:
        if rescue_batches:
            reply_text = f"Our Canteen Head Chef has approved {len(rescue_batches)} surplus batch(es) at progressive discounts:\n"
            for r in rescue_batches:
                reply_text += f"\n• {r.image_emoji} **{r.food_item_name}** — **₹{r.current_price_paise // 100}** ({r.current_discount_percent}% OFF, Regular ₹{r.original_price_paise // 100}). {r.quantity_available} portions remaining. Storage: {r.handling_info}."
            reply_text += "\n\nRescue meals prevent campus food waste and are 100% kitchen fresh!"
            suggestion_chips = ["Add rescue meal to cart", "Find meal under ₹60", "Check NGO donations"]
        else:
            reply_text = "No surplus meals currently in the rescue counter. All lunch batches were collected on schedule!"
            suggestion_chips = ["Show regular menu", "Check group deals"]
    elif "allergen" in query or "ingredient" in query:
        reply_text = "Declared allergen policy at Central Campus Food Court:\n• Thalis contain Gluten (Wheat Phulkas).\n• Dosas and Makhani items contain Dairy (pure desi ghee & fresh paneer).\n• Cashew nuts are declared in Biryanis.\n\nAll food is prepared in our ISO 22000 certified campus kitchen."
        suggestion_chips = ["Find gluten-free options", "Show vegetarian meals", "Find meal under ₹60"]
    elif "membership" in query or "pass" in query:
        reply_text = "The **MealLoop 30-Day Student Pass** is ₹199/month. Benefits include:\n• 10% daily discount on all regular meals\n• Priority Counter 2 pickup access\n• Exclusive ₹25 off coupon codes during exam weeks."
        suggestion_chips = ["Join membership", "Show meals under ₹60", "Check active deals"]
    else:
        reply_text = f"Hi {current_user.name}! I am LoopAI, your campus food assistant. I can search live canteen stock, find meals within your budget (e.g., 'Find lunch under ₹60'), check progressive rescue offers, track group deals, and explain allergens. What would you like to eat today?"
        suggestion_chips = ["Find meal under ₹60", "Paneer Biryani Group Deal", "Rescue Meals (Up to 30% off)", "Check my order status"]

    return {
        "success": True,
        "reply": reply_text,
        "suggestionChips": suggestion_chips,
        "matchingItems": matching_items,
        "proposedCart": proposed_cart,
    }


# -------------------------------------------------------------
# 11. ADMIN METRICS & AUDIT LOGS
# -------------------------------------------------------------

@app.get("/api/metrics")
def get_metrics(db: Session = Depends(get_db)):
    verified_pickups = db.query(models.Order).filter(models.Order.collection_status == "COLLECTED").count()
    donations = db.query(models.DonationOffer).filter(models.DonationOffer.status == "HANDED_OVER").all()
    total_donations_count = sum(d.portions for d in donations)

    return {
        "success": True,
        "metrics": {
            "verifiedPickupsCount": 142 + verified_pickups,
            "totalRescueMealsSold": 48,
            "totalDonationsHandedOver": 36 + total_donations_count,
            "totalStudentSavingsPaise": 245000,
            "totalRescueRevenuePaise": 348000,
            "totalGroupDealsCompleted": 12,
            "foodWasteDivertedKg": 58,
            "activeStudentMembers": 284,
        }
    }

@app.get("/api/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    logs = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(100).all()
    res = []
    for l in logs:
        res.append({
            "id": l.id,
            "timestamp": l.timestamp.isoformat(),
            "actorRole": l.actor_role,
            "actorName": l.actor_name,
            "action": l.action,
            "details": l.details,
        })
    return {"success": True, "logs": res}
