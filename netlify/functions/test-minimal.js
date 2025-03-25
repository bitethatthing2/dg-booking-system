const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

const app = express();
const router = express.Router();

app.use(cors());
app.use(express.json());

router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from test function!' });
});

app.use('/.netlify/functions/test-minimal', router);

exports.handler = serverless(app); 