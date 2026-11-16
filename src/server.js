const app = require('./app');
const config = require('./config');
const bootstrapStaff = require('./bootstrapStaff');

bootstrapStaff();

app.listen(config.port, () => {
  console.log(`Song dedications API running on http://localhost:${config.port}`);
});
