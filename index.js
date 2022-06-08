"use strict";
require("dotenv").config();
const cors = require('cors')
const express = require("express");
const mongoose = require("mongoose");


const app = express();
const port = process.env.PORT || 3000;
const oneDay = 1000 * 60 * 60 * 24;


// Connect to MongoDB
mongoose.connect(
  process.env.DB_CONNECT, 
  () => console.log("Connected to MongoDB.")
);


// Router Files
const authRoute = require("./routes/auth");


// Express Server Options
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.set('json spaces', 2);


// API ENDPOINTS
app.get('/', (req, res) => {
  res.send('')
});


app.use("/api/user", authRoute);


app.listen(port, () => {
  console.log(`API is listening at http://localhost:${port}`)
});