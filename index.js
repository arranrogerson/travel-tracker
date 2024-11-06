const express = require("express");
const pg = require("pg");
const app = express();
const port = 3000;


// create the client and connect to the database
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "password",
  port: 5432,
});
db.connect();

// middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// different users have different ids
let currentUserId = 1;

let users = [
  { id: 1, name: "Biggs", color: "teal" },
  { id: 2, name: "Wedge", color: "powderblue" },
];

// asynchronous function that, when called, queries the visited_countries table for the country_code field and joins it with the users table,
// on the criteria that the ids from the users table matches the current user_id in the script
// capture that data in the result variable
async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1; ",
    [currentUserId]);
  // extract an array of country codes
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  // when the function is called, return an array of the country codes the current user has visited
  return countries;
}

// when called, this function queries the users table for the users, and finds the current one
async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}

// homepage; get the current user and check which contries they've visited
// render the homepage embedded with the users and the countries the've visited
app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color
  });
});

// when the user clicks the 'add' button (submits a form) to add a country
app.post("/add", async (req, res) => {
  // capture their input
  const input = req.body["country"];
  // get the current user
  const currentUser = await getCurrentUser();

  // match the input to a country on the map and capture that country in the result variable
  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    // extract the country
    const data = result.rows[0];
    // extract the country code from the country
    const countryCode = data.country_code;
    // update the database with the country, adding it to the correct user
    try {
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      // then reload the homepage
      res.redirect("/");
    } catch (err) {
      console.log(err);
    }
  } catch (err) {
    console.log(err);
  }
});

// when the the user clicks on different tabs at the top of the page
app.post("/user", async (req, res) => {
  // if they click the 'add new family member' tab, render the 'new' template, which allows them to choose a name and color for the new family member
  if (req.body.add === "new") {
    res.render("new.ejs");
  // if they click any other tab (all of which are family members), change the current user to whatever they clicked and reload the homepage
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

// when the user fills out the new family member form
app.post("/new", async (req, res) => {
  // capture the submitted data in variables
  const name = req.body.name;
  const color = req.body.color;
  // update the database with the new family member, their name, and their color
  const result = await db.query("INSERT INTO users (name, color) VALUES ($1, $2) RETURNING *;", [name, color]);
  // capture the id of the new user and set that to the current user
  const id = result.rows[0].id;
  currentUserId = id;
  // then reload the homepage
  res.redirect("/");
});

// start the server and let us know when it's running
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
