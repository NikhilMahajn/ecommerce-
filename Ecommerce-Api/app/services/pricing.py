from groq import Groq
import time
from sqlalchemy.orm import Session
from app.models.models import Product, ProductAnalytics
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class PricingService:
    """Dynamic pricing service using Groq AI based on product analytics"""

    def __init__(self):
        self.client = Groq(api_key=settings.groq_api_key or "")
        self.rate_limit_delay = 1  # seconds between API calls
        
    def get_price_adjustment_from_groq(self, product: Product, analytics: ProductAnalytics) -> float:
        """
        Get price adjustment percentage from Groq AI
        Returns a float between -0.2 to 0.2 (representing -20% to +20%)
        """
        if not self.client.api_key:
            logger.warning("GROQ_API_KEY not configured, using no adjustment")
            return 0.0

        prompt = f"""
        You are a pricing optimization model for an e-commerce platform.

        Analyze the following product metrics and suggest a price adjustment:

        Product: {product.title}
        Base Price: {product.price}
        Stock Available: {product.stock}
        Views: {analytics.views}
        Cart Additions: {analytics.cart_adds}
        Purchases: {analytics.purchases}
        Current Discount: {product.discount_percentage}%

        Based on demand signals (views, cart adds, purchases) and inventory level, 
        suggest a price adjustment percentage between -0.2 to 0.2.

        Guidelines:
        - High demand (high cart adds + purchases) with low stock → increase price (positive adjustment)
        - Low demand (low views + cart adds) with high stock → decrease price (negative adjustment)
        - Balance between demand and stock levels
        - Consider conversion rate (purchases / cart adds)

        Only return a float number like 0.1 or -0.05. No explanation needed.
        """

        try:
            response = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a pricing optimization model. Only respond with a single float number between -0.2 and 0.2"
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=10
            )

            output = response.choices[0].message.content.strip()
            
            # Extract float from response
            # Handle cases like "0.1" or "-0.05" or wrapped in other text
            try:
                adjustment = float(output)
            except ValueError:
                # Try to extract number from response
                import re
                numbers = re.findall(r'-?\d+\.?\d*', output)
                if numbers:
                    adjustment = float(numbers[0])
                else:
                    adjustment = 0.0

        except Exception as e:
            logger.error(f"Groq API error for product {product.id}: {str(e)}")
            adjustment = 0.0

        # Safety constraints - very important
        adjustment = max(-0.2, min(0.2, adjustment))

        return adjustment

    def calculate_new_price(self, product: Product, analytics: ProductAnalytics) -> float:
        """
        Calculate new price based on adjustment from Groq
        """
        adjustment = self.get_price_adjustment_from_groq(product, analytics)
        
        # Calculate new price
        new_price = product.price * (1 + adjustment)
        
        # Round to 2 decimal places
        final_price = round(new_price, 2)
        
        logger.info(
            f"Product {product.id} ({product.title}): "
            f"Old Price: {product.price}, "
            f"Adjustment: {adjustment*100:.1f}%, "
            f"New Price: {final_price}"
        )
        
        return final_price

    def update_product_price(self, db: Session, product: Product) -> bool:
        """
        Update a single product's price based on analytics
        Returns True if price was updated, False otherwise
        """
        try:
            # Get or create analytics
            analytics = db.query(ProductAnalytics).filter(
                ProductAnalytics.product_id == product.id
            ).first()

            if not analytics:
                logger.debug(f"No analytics found for product {product.id}, skipping price update")
                return False

            # Calculate new price
            new_price = self.calculate_new_price(product, analytics)

            # Update only if price changed
            if new_price != product.price:
                product.price = new_price
                db.add(product)
                return True
            
            return False

        except Exception as e:
            logger.error(f"Error updating price for product {product.id}: {str(e)}")
            return False

    def update_all_products_prices(self, db: Session) -> dict:
        """
        Update prices for all published products
        Returns dict with update statistics
        """
        try:
            products = db.query(Product).filter(
                Product.is_published == True
            ).all()

            total_products = len(products)
            updated_products = 0
            failed_products = 0

            logger.info(f"Starting price update for {total_products} products")

            for product in products:
                try:
                    if self.update_product_price(db, product):
                        updated_products += 1
                    
                    # Rate limiting - sleep after each API call
                    time.sleep(self.rate_limit_delay)

                except Exception as e:
                    logger.error(f"Failed to update product {product.id}: {str(e)}")
                    failed_products += 1
                    continue

            # Commit all changes
            try:
                db.commit()
            except Exception as e:
                logger.error(f"Failed to commit price updates: {str(e)}")
                db.rollback()
                updated_products = 0

            result = {
                "total_products": total_products,
                "updated_products": updated_products,
                "failed_products": failed_products,
                "status": "completed"
            }

            logger.info(f"Price update completed: {result}")
            return result

        except Exception as e:
            logger.error(f"Error in update_all_products_prices: {str(e)}")
            return {
                "total_products": 0,
                "updated_products": 0,
                "failed_products": 0,
                "status": "error",
                "error": str(e)
            }
