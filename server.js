const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const user = require('./models/user');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb+srv://sanganiviraj263:inBxMZuqFbWqBMwO@cluster0.zrpgr.mongodb.net/Demobase').then(() => {
    console.log("Monogodb Is connected");
}).catch((e) => {
    console.log("Monogodb Connection Error : ", e);
})

app.listen(PORT, () => {
    console.log("server is runnings");
})

app.get('/', (req, res) => {
    res.send('Hello, Node.js!');
});

app.post('/user', async (req, res) => {
    const { name, age, email } = req.body;
    const newUser = new user({ name, age, email });

    await newUser.save()
        .then((users) => { res.json(users) })
        .catch((e) => { res.status(500).json({ message: 'error saving user', err: e }) });
})

// Update a user
app.put('/user/:id', (req, res) => {
    const { name, age, email } = req.body;
    user.findByIdAndUpdate(req.params.id, { name, age, email }, { new: true })
        .then((user) => res.json(user))
        .catch((err) => res.status(500).json({ message: 'Error updating user', error: err }));
});

// Delete a user
app.delete('/user/:id', (req, res) => {
    user.findByIdAndDelete(req.params.id)
        .then(() => res.json({ message: 'User deleted' }))
        .catch((err) => res.status(500).json({ message: 'Error deleting user', error: err }));
});

// Fetch users by query
app.get('/user/search', (req, res) => {
    const { name, age } = req.query;
    const filter = {};

    if (name) filter.name = name;
    if (age) filter.age = age;

    user.find(filter)
        .then((users) => res.json(users))
        .catch((err) => res.status(500).json({ message: 'Error retrieving users', error: err }));
});
