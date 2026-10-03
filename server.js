const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB (Replace with your MongoDB Atlas URI)
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/earnapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected')).catch(err => console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    balance: { type: Number, default: 0 },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Transaction Schema
const TransactionSchema = new mongoose.Schema({
    phone: String,
    type: String, // 'EARN' or 'WITHDRAWAL'
    amount: Number,
    status: { type: String, default: 'Pending' }, // Pending, Approved, Completed
    createdAt: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', TransactionSchema);

// Register / Login Route
app.post('/api/auth', async (req, res) => {
    const { phone, name } = req.body;
    try {
        let user = await User.findOne({ phone });
        if (!user) {
            user = new User({ phone, name: name || 'User', balance: 0 });
            await user.save();
        }
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Complete Task / Earn Route
app.post('/api/earn', async (req, res) => {
    const { phone, reward, taskName } = req.body;
    try {
        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        user.balance += Number(reward);
        await user.save();

        await Transaction.create({
            phone,
            type: 'EARN',
            amount: reward,
            status: 'Completed'
        });

        res.json({ success: true, newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Request Withdrawal (M-Pesa)
app.post('/api/withdraw', async (req, res) => {
    const { phone, amount } = req.body;
    try {
        const user = await User.findOne({ phone });
        if (!user || user.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        user.balance -= Number(amount);
        await user.save();

        const tx = await Transaction.create({
            phone,
            type: 'WITHDRAWAL',
            amount,
            status: 'Pending'
        });

        res.json({ success: true, newBalance: user.balance, transaction: tx });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin: Get All Pending Withdrawals & Users
app.get('/api/admin/data', async (req, res) => {
    try {
        const users = await User.find();
        const transactions = await Transaction.find().sort({ createdAt: -1 });
        res.json({ success: true, users, transactions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin: Approve Payout
app.post('/api/admin/approve', async (req, res) => {
    const { transactionId } = req.body;
    try {
        const tx = await Transaction.findById(transactionId);
        if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });

        tx.status = 'Completed';
        await tx.save();

        // TODO: Trigger Safaricom Daraja B2C API payout here automatically!

        res.json({ success: true, message: 'Payout approved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
      
