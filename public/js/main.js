document.addEventListener('DOMContentLoaded', () => {

    // --- STATE & CORE FUNCTIONS ---
    let cart = JSON.parse(localStorage.getItem('miraCart')) || [];

    const saveCart = () => {
        localStorage.setItem('miraCart', JSON.stringify(cart));
    };

    const updateCartUI = () => {
        const cartCountBadge = document.querySelector('.cart-count');
        if (!cartCountBadge) return;

        let totalItems = 0;
        cart.forEach(item => { totalItems += item.quantity; });
        cartCountBadge.innerText = cart.length;

        const currentOrderBar = document.getElementById('current-order-bar');
        if (currentOrderBar) {
            if (cart.length > 0) {
                let totalPrice = 0;
                cart.forEach(item => { totalPrice += item.price * item.quantity; });
                document.getElementById('order-bar-items').innerText = `${totalItems} ${totalItems > 1 ? 'items' : 'item'}`;
                document.getElementById('order-bar-total').innerText = `₱${totalPrice.toFixed(2)}`;
                currentOrderBar.style.display = 'block';
            } else {
                currentOrderBar.style.display = 'none';
            }
        }
    };

    const addToCart = (id, name, price, quantity) => {
        const existingItem = cart.find(item => item.id === id);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({ id, name, price, quantity });
        }
        saveCart();
        updateCartUI();
    };


    // --- PAGE-SPECIFIC LOGIC ---

    // Logic for the PRODUCT DETAIL PAGE
    const detailPage = document.querySelector('.product-detail-page');
    if (detailPage) {
        const quantityInput = document.getElementById('quantity-input');
        const quantityMinus = document.getElementById('quantity-minus');
        const quantityPlus = document.getElementById('quantity-plus');
        const totalPriceEl = document.getElementById('total-price');
        const addToCartBtn = document.getElementById('add-to-cart-btn');
        const basePrice = parseFloat(document.getElementById('product-price').innerText.replace('₱', ''));

        const updateTotalPrice = () => {
            const quantity = parseInt(quantityInput.value);
            const newTotal = basePrice * quantity;
            totalPriceEl.innerText = `₱${newTotal.toFixed(2)}`;
        };

        quantityMinus.addEventListener('click', () => {
            let currentValue = parseInt(quantityInput.value);
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
                updateTotalPrice();
            }
        });

        quantityPlus.addEventListener('click', () => {
            let currentValue = parseInt(quantityInput.value);
            quantityInput.value = currentValue + 1;
            updateTotalPrice();
        });

        addToCartBtn.addEventListener('click', () => {
            const id = addToCartBtn.dataset.productId;
            const name = document.getElementById('product-name').innerText;
            const price = basePrice;
            const quantity = parseInt(quantityInput.value);

            addToCart(id, name, price, quantity);
            
            window.location.href = '/';
        });
    }

    // Logic for the CART PAGE
    const cartPage = document.querySelector('.cart-main-content');
    if (cartPage) {
        const itemsContainer = document.getElementById('cart-items-container');
        const emptyCartView = document.getElementById('empty-cart-view');
        const cartSummaryWrapper = document.getElementById('cart-summary-wrapper');
        
        const renderCartPage = () => {
            itemsContainer.innerHTML = '';

            if (cart.length === 0) {
                emptyCartView.style.display = 'block';
                cartSummaryWrapper.style.display = 'none';
                document.getElementById('cart-header-count').innerText = '0 items';
            } else {
                emptyCartView.style.display = 'none';
                cartSummaryWrapper.style.display = 'block';

                let subtotal = 0;
                let totalItems = 0;

                cart.forEach(item => {
                    const itemSubtotal = item.price * item.quantity;
                    subtotal += itemSubtotal;
                    totalItems += item.quantity;

                    const itemElement = document.createElement('div');
                    itemElement.classList.add('card', 'cart-item-card', 'mb-3');
                    itemElement.innerHTML = `
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <h5 class="card-title">${item.name}</h5>
                                <button class="btn-delete-item" data-product-id="${item.id}"><i class="bi bi-trash3"></i></button>
                            </div>
                            <p class="card-text text-muted">₱${item.price.toFixed(2)} each</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="d-flex align-items-center">
                                    <button class="btn btn-quantity" data-product-id="${item.id}" data-action="decrease">-</button>
                                    <span class="mx-3 fs-5 fw-bold">${item.quantity}</span>
                                    <button class="btn btn-quantity btn-primary" data-product-id="${item.id}" data-action="increase">+</button>
                                </div>
                                <div>
                                    <small class="text-muted">Subtotal</small>
                                    <p class="fw-bold text-primary fs-5 mb-0">₱${itemSubtotal.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    `;
                    itemsContainer.appendChild(itemElement);
                });

                document.getElementById('cart-header-count').innerText = `${totalItems} ${totalItems > 1 ? 'items' : 'item'}`;
                document.getElementById('summary-subtotal').innerText = `₱${subtotal.toFixed(2)}`;
                document.getElementById('summary-total').innerText = `₱${subtotal.toFixed(2)}`;
            }
        };

        itemsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const productId = target.dataset.productId;
            if (!productId) return;

            const itemInCart = cart.find(item => item.id === productId);

            if (target.classList.contains('btn-delete-item')) {
                cart = cart.filter(item => item.id !== productId);
            }
            if (target.dataset.action === 'increase') {
                itemInCart.quantity++;
            }
            if (target.dataset.action === 'decrease') {
                if (itemInCart.quantity > 1) {
                    itemInCart.quantity--;
                } else {
                    cart = cart.filter(item => item.id !== productId);
                }
            }
            
            saveCart();
            renderCartPage();
        });
        
        // --- PLACE ORDER LOGIC ---
        const placeOrderBtn = document.querySelector('.place-order-footer button');
        placeOrderBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                alert('Your cart is empty.');
                return;
            }

            fetch('/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cart: cart }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Clear the cart
                    cart = [];
                    saveCart();
                    // Show success message and redirect
                    alert(`Order placed successfully! Your Order ID is: ${data.orderId}`);
                    window.location.href = '/';
                } else {
                    // Show error message
                    alert(`Error placing order: ${data.message}`);
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                alert('An error occurred while placing the order. Please try again.');
            });
        });
        
        renderCartPage();
    }

    // --- INITIALIZATION ---
    updateCartUI();
});