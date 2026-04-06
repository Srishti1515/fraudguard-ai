from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User

router = APIRouter()

class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str
    address: str = ""
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    full_name: str
    is_admin: bool

@router.post("/register", status_code=201)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.phone_number == payload.phone_number).first():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone_number=payload.phone_number,
        address=payload.address,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Registration successful", "user_id": user.id}

@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token({"sub": str(user.id)})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        full_name=user.full_name,
        is_admin=user.is_admin,
    )
