const bcrypt = require('bcryptjs');
bcrypt.hash('Unique@123', 12).then(hash => console.log(hash));
