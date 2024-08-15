import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { products, users, carts, orders } from './storage.js';
import { AppError } from './errors.js';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
    });
});


const userValidationMiddleware = (req, res, next) => {
    const userId = req.header('x-user-id');
    if (!userId) return next(new AppError('Unauthorized. Invalid x-user-id.', 401));

    const user = users.find(u => u.id === userId);
    if (!user) return next(new AppError('User not found.', 404));

    req.userId = userId;
    next();
};


const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(email);
};


const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    return passwordRegex.test(password);
};


app.post('/api/register', (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) return next(new AppError('Email and password are required.', 400));
    if (!validateEmail(email)) return next(new AppError('Invalid email format.', 400));
    if (!validatePassword(password)) return next(new AppError('Password does not meet complexity requirements.', 400));

    const userId = randomUUID();
    const newUser = { id: userId, email, password };
    users.push(newUser);

    res.json({ id: userId, email });
});


app.get('/api/products', (req, res) => res.json(products));


app.get('/api/products/:productId', (req, res) => {
    const product = products.find(p => p.id == req.params.productId);
    product ? res.json(product) : res.status(404).json({ message: "Product not found." });
});


app.put('/api/cart/:productId', userValidationMiddleware, (req, res, next) => {
    const { productId } = req.params;
    const product = products.find(p => p.id == productId);
    if (!product) return next(new AppError('Product not found.', 404));

    let cart = carts.find(c => c.userId === req.userId);
    if (!cart) {
        cart = { id: randomUUID(), userId: req.userId, products: [] };
        carts.push(cart);
    }

    cart.products.push(product);
    res.json(cart);
});


app.delete('/api/cart/:productId', userValidationMiddleware, (req, res, next) => {
    const { productId } = req.params;
    const cart = carts.find(c => c.userId === req.userId);
    if (!cart) return next(new AppError('Cart not found.', 404));

    cart.products = cart.products.filter(p => p.id != productId);
    res.json(cart);
});


app.post('/api/cart/checkout', userValidationMiddleware, (req, res, next) => {
    const cart = carts.find(c => c.userId === req.userId);
    if (!cart || cart.products.length === 0) return next(new AppError('Cart is empty or not found.', 400));

    const order = {
        id: randomUUID(),
        userId: req.userId,
        products: cart.products,
        totalPrice: cart.products.reduce((sum, product) => sum + product.price, 0),
    };

    orders.push(order);
    cart.products = []; 

    res.json(order);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
