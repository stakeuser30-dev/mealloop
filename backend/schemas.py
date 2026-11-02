from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

class UserSchema(BaseModel):
    id: str
    name: str
    email: str
    role: str
    studentId: Optional[str] = None
    hostel: Optional[str] = None
    canteenId: Optional[str] = None
    organizationName: Optional[str] = None
    hasActiveMembership: bool = False
    membershipExpiry: Optional[str] = None
    membershipSavingsPaise: int = 0
    referralCode: str
    referralCreditsPaise: int = 0
    phone: Optional[str] = None

class SwitchDemoRequest(BaseModel):
    role: str # 'student' | 'staff' | 'admin' | 'ngo'

class CanteenSchema(BaseModel):
    id: str
    name: str
    campus: str
    locationDesc: str
    openingHours: str
    pickupSlots: List[str]
    contactNumber: str
    isOpen: bool = True

class FoodItemSchema(BaseModel):
    id: str
    canteenId: str
    name: str
    category: str
    pricePaise: int
    isVeg: bool = True
    description: str
    ingredients: List[str] = []
    allergens: List[str] = []
    stockAvailable: int = 20
    imageEmoji: str = "🍱"
    prepTimeMins: int = 8
    customisations: Optional[List[Dict[str, Any]]] = None
    isFeatured: Optional[bool] = False

class UpdateStockRequest(BaseModel):
    stockAvailable: int

class GroupDealSchema(BaseModel):
    id: str
    title: str
    foodItemId: str
    foodItemName: str
    regularPricePaise: int
    groupPricePaise: int
    currentParticipants: int
    targetParticipants: int
    status: str
    expiresAt: str
    participantIds: List[str] = []
    pickupSlot: str
    canteenName: str
    imageEmoji: str = "🥘"

class RescueMealBatchSchema(BaseModel):
    id: str
    foodItemId: str
    foodItemName: str
    originalPricePaise: int
    quantityAvailable: int
    reason: str
    preparedAt: str
    offerStartedAt: str
    saleCutoff: str
    handoverCutoff: str
    handlingInfo: str
    allergens: List[str] = []
    baseDiscountPercent: int
    currentDiscountPercent: int
    currentPricePaise: int
    ngoNotified: bool = False
    status: str
    imageEmoji: str = "🍱"
    canteenName: str

class AdvanceClockRequest(BaseModel):
    addHours: Optional[int] = 1
    reset: Optional[bool] = False

class ApproveRescueBatchRequest(BaseModel):
    foodItemId: str
    quantity: int
    reason: Optional[str] = "Staff approved unreserved lunch surplus"
    handlingInfo: Optional[str] = "Hot-holding case at 68°C"

class DonationOfferSchema(BaseModel):
    id: str
    rescueBatchId: str
    canteenName: str
    foodItemName: str
    portions: int
    handlingInfo: str
    location: str
    pickupCutoff: str
    status: str
    ngoOrgName: str
    acceptedAt: Optional[str] = None
    handedOverAt: Optional[str] = None
    verifiedByStaff: Optional[str] = None
    imageEmoji: str = "🍲"

class CartItemInput(BaseModel):
    foodItemId: str
    name: str
    pricePaise: int
    quantity: int
    isVeg: bool = True
    isRescue: Optional[bool] = False
    rescueBatchId: Optional[str] = None
    isGroupDeal: Optional[bool] = False
    imageEmoji: Optional[str] = "🍱"

class CartCalculateRequest(BaseModel):
    items: List[CartItemInput]
    couponCode: Optional[str] = None
    useReferralCredits: Optional[bool] = False

class RazorpayOrderRequest(BaseModel):
    amountPaise: int
    receipt: Optional[str] = None

class VerifyAndOrderRequest(BaseModel):
    items: List[CartItemInput]
    pickupSlot: Optional[str] = "12:45 PM – 01:00 PM"
    itemTotalPaise: int
    discountPaise: Optional[int] = 0
    couponCode: Optional[str] = None
    appliedCouponDiscountPaise: Optional[int] = 0
    membershipDiscountPaise: Optional[int] = 0
    referralDiscountPaise: Optional[int] = 0
    taxesPaise: Optional[int] = 0
    payableAmountPaise: int
    razorpayOrderId: Optional[str] = None
    razorpayPaymentId: Optional[str] = None

class PickupScanRequest(BaseModel):
    qrString: Optional[str] = None
    manualToken: Optional[str] = None

class AIChatRequest(BaseModel):
    message: str
    chatHistory: Optional[List[Dict[str, str]]] = None

class PreorderCreateRequest(BaseModel):
    eventTitle: str
    eventDate: str
    pickupTime: str
    headCount: int
    itemsRequested: Optional[List[Dict[str, Any]]] = None
    specialInstructions: Optional[str] = ""
    contactPhone: Optional[str] = None

class PreorderQuoteRequest(BaseModel):
    quotedPricePaise: int
    canteenRemarks: Optional[str] = "Confirmed kitchen capacity"
