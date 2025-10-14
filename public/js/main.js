document.addEventListener('DOMContentLoaded', () => {

    // --- Audio Unlock for Mobile Devices ---
    const audioBanner = document.getElementById('audio-enable-banner');
    const enableAudioBtn = document.getElementById('enable-audio-btn');
    const notificationSound = document.getElementById('notification-sound');

    // Check if the user has already enabled audio. If not, show the banner.
    if (localStorage.getItem('audioEnabled') !== 'true' && notificationSound) {
        if (audioBanner) audioBanner.classList.add('show');
    }

    if (enableAudioBtn) {
        enableAudioBtn.addEventListener('click', () => {
            // Play and immediately pause the sound to "prime" it
            notificationSound.play();
            notificationSound.pause();
            notificationSound.currentTime = 0;

            // Save the user's choice and hide the banner
            localStorage.setItem('audioEnabled', 'true');
            if (audioBanner) audioBanner.classList.remove('show');
        }, { once: true });
    }


    // --- REAL-TIME UPDATES (SOCKET.IO) ---
    const socket = io();

    socket.on('newOrder', (newOrder) => {
        if (
            document.querySelector('.cook-main-content') ||
            document.querySelector('.admin-main-container') || 
            document.querySelector('.admin-container')
        ) {
            location.reload();
        }
    });

    socket.on('orderStatusUpdated', (data) => {
        const salesNavLink = document.querySelector('.bottom-nav-frontline a[href="/sales"]');
        if (salesNavLink) {
            let badge = salesNavLink.querySelector('.nav-badge');
            let currentCount = badge ? parseInt(badge.innerText) || 0 : 0;

            if (data.oldStatus !== 'Ready' && data.newStatus === 'Ready') {
                currentCount++;
                
                if ('vibrate' in navigator) {
                    navigator.vibrate(200);
                }

                // Only play sound if the user has enabled it
                if (notificationSound && localStorage.getItem('audioEnabled') === 'true') {
                    notificationSound.play().catch(error => console.log("Audio playback failed:", error));
                }

            } else if (data.oldStatus === 'Ready' && data.newStatus !== 'Ready') {
                currentCount--;
            }

            if (currentCount > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.classList.add('badge', 'rounded-pill', 'bg-danger', 'nav-badge');
                    salesNavLink.appendChild(badge);
                }
                badge.innerText = currentCount;
            } else {
                if (badge) {
                    badge.remove();
                }
            }
        }

        if (
            document.querySelector('.cook-main-content') || 
            document.querySelector('.sales-main-content') ||
            document.querySelector('.admin-main-container') || 
            document.querySelector('.admin-container')
        ) {
            setTimeout(() => {
                location.reload();
            }, 250);
        }
    });

    // --- STATE & CORE FUNCTIONS (CART) ---
    let cart = JSON.parse(localStorage.getItem('miraCart')) || [];

    const saveCart = () => {
        localStorage.setItem('miraCart', JSON.stringify(cart));
    };

    const updateCartUI = () => {
        const cartCountBadge = document.querySelector('.cart-count');
        if (cartCountBadge) {
            cartCountBadge.innerText = cart.length;
        }

        const currentOrderBar = document.getElementById('current-order-bar');
        if (currentOrderBar) {
            if (cart.length > 0) {
                let totalItems = 0;
                let totalPrice = 0;
                cart.forEach(item => {
                    totalItems += item.quantity;
                    totalPrice += item.price * item.quantity;
                });
                document.getElementById('order-bar-items').innerText = `${totalItems} ${totalItems > 1 ? 'items' : 'item'}`;
                document.getElementById('order-bar-total').innerText = `₱${totalPrice.toFixed(2)}`;
                currentOrderBar.classList.add('show');
            } else {
                currentOrderBar.classList.remove('show');
            }
        }
    };

    const addToCart = (id, name, price, quantity, sizeLabel) => {
        const cartItemId = sizeLabel ? `${id}-${sizeLabel}` : id;
        
        const existingItem = cart.find(item => item.cartItemId === cartItemId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({ cartItemId, id, name, price, quantity, sizeLabel });
        }
        saveCart();
        updateCartUI();
    };

    // --- PAGE-SPECIFIC LOGIC ---

    // ## Frontliner: Main Menu Page ##
    const menuPage = document.querySelector('.frontline-main-content');
    if (menuPage) {
        let lastScrollTop = 0;
        const currentOrderBar = document.getElementById('current-order-bar');
        window.addEventListener('scroll', function() {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop > lastScrollTop) {
                currentOrderBar.classList.add('is-hidden-on-scroll');
            } else {
                currentOrderBar.classList.remove('is-hidden-on-scroll');
            }
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        }, false);

        const searchInput = document.getElementById('searchMenu');
        const productItems = menuPage.querySelectorAll('.row.g-3 .col-6');
        if (searchInput && productItems.length > 0) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                productItems.forEach(item => {
                    const productName = item.querySelector('.card-title a').innerText.toLowerCase();
                    const categoryName = item.querySelector('.badge-category').innerText.toLowerCase();
                    
                    if (productName.includes(searchTerm) || categoryName.includes(searchTerm)) {
                        item.classList.remove('d-none');
                    } else {
                        item.classList.add('d-none');
                    }
                });
            });
        }
        
        const productGrid = menuPage.querySelector('.row.g-3');
        if(productGrid) {
            productGrid.addEventListener('click', (e) => {
                const addButton = e.target.closest('.btn-add-to-cart');
                if (addButton) {
                    e.preventDefault(); 
                    const card = addButton.closest('.product-card-frontline');
                    if (card && card.dataset.productId) {
                        const id = card.dataset.productId;
                        const name = card.dataset.productName;
                        const price = parseFloat(card.dataset.productPrice);
                        addToCart(id, name, price, 1, null);
                    }
                }
            });
        }
    }

    // ## Frontliner: Product Detail Page ##
    const detailPage = document.querySelector('.product-detail-page');
    if (detailPage) {
        const quantityInput = document.getElementById('quantity-input');
        const quantityMinus = document.getElementById('quantity-minus');
        const quantityPlus = document.getElementById('quantity-plus');
        const priceEl = document.getElementById('product-price');
        const totalPriceEl = document.getElementById('total-price');
        const addToCartBtn = document.getElementById('add-to-cart-btn');
        const variantButtons = document.querySelectorAll('.btn-variant');
        
        let currentPrice = parseFloat(priceEl.innerText.replace('₱', ''));
        let selectedSizeLabel = null;

        const updateTotalPrice = () => {
            const quantity = parseInt(quantityInput.value);
            const newTotal = currentPrice * quantity;
            totalPriceEl.innerText = `₱${newTotal.toFixed(2)}`;
        };

        variantButtons.forEach(button => {
            button.addEventListener('click', () => {
                variantButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                currentPrice = parseFloat(button.dataset.price);
                selectedSizeLabel = button.dataset.sizeLabel;
                priceEl.innerText = `₱${currentPrice.toFixed(2)}`;
                updateTotalPrice();
            });
        });

        if (variantButtons.length > 0) {
            variantButtons[0].click();
        }

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
            const price = currentPrice;
            const quantity = parseInt(quantityInput.value);
            const sizeLabel = selectedSizeLabel;
            addToCart(id, name, price, quantity, sizeLabel);
            window.location.href = '/';
        });
    }

    // ## Frontliner: Cart Page ##
    const cartPage = document.querySelector('.cart-main-content');
    if (cartPage) {
        let isDiscounted = false;
        let selectedPaymentMethod = 'Cash';

        const itemsContainer = document.getElementById('cart-items-container');
        const emptyCartView = document.getElementById('empty-cart-view');
        const cartSummaryWrapper = document.getElementById('cart-summary-wrapper');
        const paymentMethodBtns = document.querySelectorAll('.payment-method-btn');
        const discountBtn = document.getElementById('discount-btn');
        
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
                                <button class="btn-delete-item" data-cart-item-id="${item.cartItemId}"><i class="bi bi-trash3"></i></button>
                            </div>
                            <p class="card-text text-muted">₱${item.price.toFixed(2)} each</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="d-flex align-items-center">
                                    <button class="btn btn-quantity" data-cart-item-id="${item.cartItemId}" data-action="decrease">-</button>
                                    <span class="mx-3 fs-5 fw-bold">${item.quantity}</span>
                                    <button class="btn btn-quantity btn-primary" data-cart-item-id="${item.cartItemId}" data-action="increase">+</button>
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

                const discountRow = document.getElementById('discount-row');
                const discountAmountEl = document.getElementById('summary-discount');
                let discountAmount = 0;
                let finalTotal = subtotal;

                if (isDiscounted) {
                    discountAmount = subtotal * 0.20;
                    finalTotal = subtotal - discountAmount;
                    discountAmountEl.innerText = `- ₱${discountAmount.toFixed(2)}`;
                    discountRow.style.display = 'flex';
                    discountBtn.classList.add('active');
                    discountBtn.innerHTML = '<i class="bi bi-x-circle me-1"></i>Remove Discount';
                } else {
                    discountAmountEl.innerText = `- ₱0.00`;
                    discountRow.style.display = 'none';
                    discountBtn.classList.remove('active');
                    discountBtn.innerHTML = '<i class="bi bi-percent me-1"></i>Apply Discount';
                }

                document.getElementById('cart-header-count').innerText = `${totalItems} ${totalItems > 1 ? 'items' : 'item'}`;
                document.getElementById('summary-subtotal').innerText = `₱${subtotal.toFixed(2)}`;
                document.getElementById('summary-total').innerText = `₱${finalTotal.toFixed(2)}`;
            }
        };

        itemsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const cartItemId = target.dataset.cartItemId;
            if (!cartItemId) return;

            const itemInCart = cart.find(item => item.cartItemId === cartItemId);

            if (target.classList.contains('btn-delete-item')) {
                cart = cart.filter(item => item.cartItemId !== cartItemId);
            }
            if (target.dataset.action === 'increase') {
                itemInCart.quantity++;
            }
            if (target.dataset.action === 'decrease') {
                if (itemInCart.quantity > 1) {
                    itemInCart.quantity--;
                } else {
                    cart = cart.filter(item => item.cartItemId !== cartItemId);
                }
            }
            
            saveCart();
            renderCartPage();
        });

        paymentMethodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                paymentMethodBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedPaymentMethod = btn.dataset.method;
            });
        });

        if (discountBtn) {
            discountBtn.addEventListener('click', () => {
                isDiscounted = !isDiscounted; 
                renderCartPage();
            });
        }
        
        const placeOrderBtn = document.querySelector('.place-order-footer .btn-primary');
        placeOrderBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                alert('Your cart is empty.');
                return;
            }

            const customerName = document.getElementById('customer-name-input').value;
            let finalTotal = 0;
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            if (isDiscounted) {
                finalTotal = subtotal * 0.80;
            } else {
                finalTotal = subtotal;
            }

            fetch('/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    cart: cart, 
                    customerName: customerName,
                    paymentMethod: selectedPaymentMethod,
                    discountApplied: isDiscounted,
                    totalAmount: finalTotal
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    cart = [];
                    saveCart();
                    document.getElementById('success-order-id').innerText = data.orderId.toString().slice(-6).toUpperCase();
                    const successModal = new bootstrap.Modal(document.getElementById('orderSuccessModal'));
                    successModal.show();
                } else {
                    alert(`Error placing order: ${data.message}`);
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                alert('An error occurred while placing the order. Please try again.');
            });
        });

        const successModalEl = document.getElementById('orderSuccessModal');
        if (successModalEl) {
            successModalEl.addEventListener('hidden.bs.modal', () => {
                window.location.href = '/';
            });
        }
        
        renderCartPage();
    }

    // ## Admin Search Logic ##
    const createAdminSearchFilter = (inputId, listSelector, itemSelector, titleSelector) => {
        const searchInput = document.getElementById(inputId);
        if (searchInput) {
            const items = document.querySelectorAll(`${listSelector} ${itemSelector}`);
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                items.forEach(item => {
                    const titleElement = item.querySelector(titleSelector);
                    if (titleElement) {
                        const title = titleElement.innerText.toLowerCase();
                        if (title.includes(searchTerm)) {
                            item.style.display = item.classList.contains('list-table-row') ? 'grid' : 'block';
                        } else {
                            item.style.display = 'none';
                        }
                    }
                });
            });
        }
    };
    createAdminSearchFilter('searchProductsMobile', '.product-list-mobile', '.product-card-revamp', '.card-title');
    createAdminSearchFilter('searchProductsDesktop', '.product-list-desktop', '.list-table-row', '.fw-bold');
    createAdminSearchFilter('searchUsersMobile', '.user-list-mobile', '.user-card-link', '.card-title');
    createAdminSearchFilter('searchUsersDesktop', '.user-list-desktop', '.list-table-row', '.fw-bold');


    // ## Cook Interface: Real-time Order Timers ##
    const cookPage = document.querySelector('.cook-main-content');
    if (cookPage) {
        const updateOrderTimers = () => {
            const orderCards = document.querySelectorAll('.order-card-cook');
            orderCards.forEach(card => {
                const timerElement = card.querySelector('.order-timer');
                if (!timerElement) return;

                const createdAt = new Date(card.dataset.createdAt);
                if (isNaN(createdAt.getTime())) return;

                const elapsedSeconds = Math.floor((new Date() - createdAt) / 1000);
                const minutes = Math.floor(elapsedSeconds / 60);
                const seconds = elapsedSeconds % 60;
                
                timerElement.innerText = `(${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')})`;

                if (elapsedSeconds > 180 && !card.classList.contains('is-urgent')) {
                    card.classList.add('is-urgent');
                    const cardHeader = card.querySelector('.card-header');
                    if (cardHeader && !cardHeader.querySelector('.badge-urgent')) {
                        const urgentBadge = document.createElement('span');
                        urgentBadge.classList.add('badge', 'badge-urgent');
                        urgentBadge.innerText = 'URGENT';
                        cardHeader.appendChild(urgentBadge);
                    }
                }
            });
        };
        
        setInterval(updateOrderTimers, 1000);
        updateOrderTimers();
    }

    // ## Reusable Logout Confirmation Modal Logic ##
    const initializeLogoutModal = (modalId, progressBarId) => {
        const logoutModalEl = document.getElementById(modalId);
        if (logoutModalEl) {
            let logoutTimer;
            let countdownInterval;
            const countdownDuration = 10000;

            logoutModalEl.addEventListener('show.bs.modal', () => {
                const progressBar = document.getElementById(progressBarId);
                let timeLeft = countdownDuration;
                
                progressBar.style.width = '100%';
                progressBar.classList.remove('bg-danger');
                progressBar.classList.add('bg-primary');

                logoutTimer = setTimeout(() => {
                    window.location.href = '/logout';
                }, countdownDuration);

                countdownInterval = setInterval(() => {
                    timeLeft -= 100;
                    const widthPercentage = (timeLeft / countdownDuration) * 100;
                    progressBar.style.width = `${widthPercentage}%`;

                    if (timeLeft <= 3000) {
                        progressBar.classList.remove('bg-primary');
                        progressBar.classList.add('bg-danger');
                    }
                }, 100);
            });

            logoutModalEl.addEventListener('hide.bs.modal', () => {
                clearTimeout(logoutTimer);
                clearInterval(countdownInterval);
            });
        }
    };
    initializeLogoutModal('logoutConfirmModal', 'logout-progress-bar');
    initializeLogoutModal('adminLogoutConfirmModal', 'admin-logout-progress-bar');
    initializeLogoutModal('cookLogoutConfirmModal', 'cook-logout-progress-bar');

    // --- NEW: Admin Orders Page Logic ---
    const adminOrdersPage = document.querySelector('.filter-bar');
    if (adminOrdersPage) {
        // Initialize flatpickr for the main filter bar
        flatpickr("#filter-date-range", {
            mode: "range",
            dateFormat: "Y-m-d",
        });

        const exportModal = document.getElementById('exportModal');
        if (exportModal) {
            const exportDateRangePicker = flatpickr("#export-date-range", {
                mode: "range",
                dateFormat: "Y-m-d",
                onChange: function() {
                    document.querySelectorAll('.date-preset-btn').forEach(btn => btn.classList.remove('active'));
                    updateExportSummary();
                }
            });

            const presetButtons = exportModal.querySelectorAll('.date-preset-btn');
            const statusFilter = exportModal.querySelector('#export-status-filter');
            const fieldCheckboxes = exportModal.querySelectorAll('input[name="exportFields"]');
            const finalExportBtn = exportModal.querySelector('#final-export-btn');

            const updateExportSummary = async () => {
                const dateRange = exportDateRangePicker.input.value;
                const status = statusFilter.value;
                
                let query = new URLSearchParams();
                if (dateRange) query.append('dateRange', dateRange);
                if (status) query.append('status', status);

                try {
                    const response = await fetch(`/admin/orders/count?${query.toString()}`);
                    const data = await response.json();
                    document.getElementById('export-count').innerText = data.count || 0;
                } catch (error) {
                    console.error("Error fetching export count:", error);
                    document.getElementById('export-count').innerText = 'N/A';
                }

                const selectedCols = Array.from(fieldCheckboxes).filter(cb => cb.checked).length;
                document.getElementById('export-columns-count').innerText = selectedCols;
            };

            presetButtons.forEach(button => {
                button.addEventListener('click', () => {
                    presetButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    
                    const today = new Date();
                    let startDate, endDate = new Date();

                    switch (button.dataset.range) {
                        case 'today':
                            startDate = today;
                            break;
                        case 'week':
                            startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
                            break;
                        case 'month':
                            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                            break;
                        case '3months':
                             startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
                            break;
                    }
                    exportDateRangePicker.setDate([startDate, endDate], true);
                });
            });

            finalExportBtn.addEventListener('click', () => {
                const dateRange = exportDateRangePicker.input.value;
                const status = statusFilter.value;
                const selectedFields = Array.from(fieldCheckboxes)
                    .filter(cb => cb.checked)
                    .map(cb => cb.value);

                if (selectedFields.length === 0) {
                    alert('Please select at least one field to export.');
                    return;
                }
                
                let query = new URLSearchParams();
                if (dateRange) query.append('dateRange', dateRange);
                if (status) query.append('status', status);
                selectedFields.forEach(field => query.append('fields', field));

                window.location.href = `/admin/orders/export?${query.toString()}`;
            });
            
            exportModal.addEventListener('show.bs.modal', updateExportSummary);
            statusFilter.addEventListener('change', updateExportSummary);
            fieldCheckboxes.forEach(cb => cb.addEventListener('change', updateExportSummary));
        }
    }

    // --- INITIALIZATION ---
    updateCartUI();
});