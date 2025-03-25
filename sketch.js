// -----------------------------
// GLOBAL VARIABLES
// -----------------------------
var forestTileset;       // the full tileset image
var tileImages = [];     // array of individual tile images
var tileGroup;           // group for all tile sprites (for collisions)

var obstacleImage, bananaImage;
var idleAnim, walkAnim, runAnim;   // Animations for the player
var obstacleGroup, bananaGroup;

var bgImage, bgSprite;   // Background image and its sprite

var player;
var score = 0;

var tilemapData;         // JSON data from Tiled
var levelMap = [];       // 2D array of tile indices (parsed from tilemapData)

var mapWidth = 0;        // width of the map in tiles
var mapHeight = 0;       // height of the map in tiles
var tileSize = 64;       // display size (in px) for each tile
var mapPixelWidth = 0;   // width of the map in pixels
var mapPixelHeight = 0;  // height of the map in pixels

// Foot sensor for precise jump checking
var footSensor;   

// Hit cooldown in frames to prevent repeated collisions
var hitCooldown = 0;

// New global variable to track next obstacle spawn time (in milliseconds)
var nextObstacleSpawnTime = 0;

// Game state: "start", "play", or "gameover"
var gameState = "start";

// New: Boundary sprites for left/right edges
var leftBoundary, rightBoundary;

// NEW: Banana positions (set these to your desired coordinates)
var bananaPositions = [
  { x: 1954, y: 1009},
  { x: 2916, y: 243},
  { x: 3426, y: 1074},
  // Add more positions as needed.
];

// -----------------------------
// PRELOAD
// -----------------------------
function preload() {
  tilemapData = loadJSON("Tile map (unfinished) for game.tmj");
  forestTileset = loadImage("foresttileset.png");
  
  idleAnim = loadAnimation("Stick-Idle (1).png", "Stick-Idle (2).png");
  idleAnim.frameDelay = 10;
  walkAnim = loadAnimation("Stick-Run  (1).png", "Stick-Run  (2).png", "Stick-Run  (3).png", "Stick-Run  (4).png");
  walkAnim.frameDelay = 6;
  runAnim = loadAnimation("Stick-Run  (1).png", "Stick-Run  (2).png", "Stick-Run  (3).png", "Stick-Run  (4).png");
  runAnim.frameDelay = 3;
  
  obstacleImage = loadImage("stone.png");
  bananaImage = loadImage("banana.png");  // ensure banana.png is available
  bgImage = loadImage("niceBackground.png");
}

// -----------------------------
// SETUP
// -----------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // Prevent touch errors if needed
  p5.prototype._updateTouchCoords = function(e) { if (!e || !e.touches) return; };
  p5.prototype._updateNextTouchCoords = function(e) { if (!e || !e.touches) return; };

  // Cut out tiles (3 columns × 6 rows, each 64×64)
  var tileWidth = 64;
  var tileHeight = 64;
  var tilesetCols = 3;
  var tilesetRows = 6;
  for (var r = 0; r < tilesetRows; r++) {
    for (var c = 0; c < tilesetCols; c++) {
      var x = c * tileWidth;
      var y = r * tileHeight;
      var tileImg = forestTileset.get(x, y, tileWidth, tileHeight);
      tileImages.push(tileImg);
    }
  }

  // Create group for tiles
  tileGroup = new Group();
  parseTiledMap();
  createLevel();

  // Create obstacle group and banana group
  obstacleGroup = new Group();
  bananaGroup = new Group();

  // Create background sprite
  bgSprite = createSprite(mapPixelWidth / 2, height / 2, mapPixelWidth, height);
  bgSprite.addImage(bgImage);
  bgSprite.scale = mapPixelWidth / bgImage.width;
  bgSprite.depth = -10; // behind everything

  // Create the player (spawn point remains as defined)
  player = createSprite(300, 1040, 50, 50);
  player.addAnimation("idle", idleAnim);
  player.addAnimation("walk", walkAnim);
  player.addAnimation("run", runAnim);
  player.changeAnimation("idle");
  // Set a fixed collider regardless of visual scale
  player.setCollider("rectangle", 0, 0, 30, 80);
  player.scale = 0.9;
  player.debug = false;
  
  // Create a foot sensor positioned 40+5 pixels below player center (fixed)
  footSensor = createSprite(player.position.x, player.position.y + 40 + 5, 20, 5);
  footSensor.visible = false;  // change to true for debugging if needed

  // Initialize next obstacle spawn time (5 to 10 seconds from now)
  nextObstacleSpawnTime = millis() + random(5000, 10000);
  
  // Create boundary sprites for left/right edges
  leftBoundary = createSprite(0, mapPixelHeight / 2, 10, mapPixelHeight);
  leftBoundary.immovable = true;
  leftBoundary.visible = false;
  
  rightBoundary = createSprite(mapPixelWidth, mapPixelHeight / 2, 10, mapPixelHeight);
  rightBoundary.immovable = true;
  rightBoundary.visible = false;
  
  // Spawn bananas at predetermined positions
  spawnBananas();
}

// -----------------------------
// Function to spawn bananas at fixed positions
// -----------------------------
function spawnBananas() {
  for (var i = 0; i < bananaPositions.length; i++) {
    var pos = bananaPositions[i];
    var banana = createSprite(pos.x, pos.y, 20, 20);
    banana.addImage(bananaImage);
    banana.scale = 0.05;
    bananaGroup.add(banana);
  }
}

// -----------------------------
// Parse Tiled JSON data
// -----------------------------
function parseTiledMap() {
  mapWidth = tilemapData.width;
  mapHeight = tilemapData.height;
  mapPixelWidth = mapWidth * tileSize;
  mapPixelHeight = mapHeight * tileSize;
  
  var layer = tilemapData.layers[0];
  var rawData = layer.data;
  levelMap = [];
  for (var row = 0; row < mapHeight; row++) {
    levelMap[row] = [];
    for (var col = 0; col < mapWidth; col++) {
      var id = rawData[row * mapWidth + col];
      levelMap[row][col] = (id === 0) ? -1 : id - 1;
    }
  }
}

// -----------------------------
// CREATE LEVEL FUNCTION
// -----------------------------
function createLevel() {
  for (var row = 0; row < levelMap.length; row++) {
    for (var col = 0; col < levelMap[row].length; col++) {
      var tileIndex = levelMap[row][col];
      if (tileIndex !== -1 && tileIndex < tileImages.length) {
        var x = col * tileSize + tileSize / 2;
        var y = row * tileSize + tileSize / 2;
        var tileSprite = createSprite(x, y, tileSize, tileSize);
        tileSprite.addImage(tileImages[tileIndex]);
        tileSprite.immovable = true;
        tileGroup.add(tileSprite);
      }
    }
  }
}

// -----------------------------
// DRAW
// -----------------------------
function draw() {
  // Start Menu
  if (gameState === "start") {
    camera.off();
    background(50);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(50);
    text("Welcome to the Game!", width / 2, height / 2 - 40);
    textSize(30);
    text("Click anywhere to start", width / 2, height / 2 + 20);
    camera.on();
    return;
  }
  
  // Game Over
  if (gameState === "gameover") {
    camera.off();
    background(0);
    fill(255, 0, 0);
    textAlign(CENTER, CENTER);
    textSize(60);
    text("Game Over!", width / 2, height / 2 - 60);
    textSize(30);
    fill(255);
    text("Press R to retry or M for main menu", width / 2, height / 2);
    camera.on();
    return;
  }
  
  // Play State
  background(200);
  
  // Horizontal movement
  var speed = 0;
  if (keyDown("a") || keyDown(LEFT_ARROW)) {
    speed = keyDown(SHIFT) ? -13 : -8;
    if (player.getAnimationLabel() !== (keyDown(SHIFT) ? "run" : "walk"))
      player.changeAnimation(keyDown(SHIFT) ? "run" : "walk");
    player.velocity.x = speed;
    player.mirrorX(-1);
  } else if (keyDown("d") || keyDown(RIGHT_ARROW)) {
    speed = keyDown(SHIFT) ? 13 : 8;
    if (player.getAnimationLabel() !== (keyDown(SHIFT) ? "run" : "walk"))
      player.changeAnimation(keyDown(SHIFT) ? "run" : "walk");
    player.velocity.x = speed;
    player.mirrorX(1);
  } else {
    player.velocity.x = 0;
    if (player.getAnimationLabel() !== "idle")
      player.changeAnimation("idle");
  }
  
  // Vertical movement / Gravity
  player.velocity.y += 0.9; // gravity
  var maxFallSpeed = 18;
  player.velocity.y = constrain(player.velocity.y, -Infinity, maxFallSpeed);
  
  // Update foot sensor position using fixed offset (40 and 5)
  // Since the collider is fixed, we use 40 as the bottom offset.
  footSensor.position.x = player.position.x;
  footSensor.position.y = player.position.y + 40 + 5;
  
  // (Optional: Uncomment below to debug the foot sensor)
  // footSensor.visible = true;
  // footSensor.debug = true;
  footSensor.shapeColor = color(255, 0, 0);
  
  // Check if the foot sensor is over a tile near the fixed bottom (player.position.y + 40)
  var canJump = false;
  footSensor.overlap(tileGroup, function(sensor, tile) {
    var tileTop = tile.position.y - tileSize / 2;
    var playerBottom = player.position.y + 40;
    if (abs(tileTop - playerBottom) < 25) {
      canJump = true;
    }
  });
  
  // Allow jump only if canJump is true and space is pressed
  if (canJump && keyWentDown("space")) {
    player.velocity.y = -15;
  }
  
  // Collide with tiles
  player.collide(tileGroup);
  
  // Prevent player from moving off left/right boundaries
  player.collide(leftBoundary);
  player.collide(rightBoundary);
  
  // 2D camera: follow player
  camera.position.x = player.position.x;
  camera.position.y = player.position.y;
  
  // Constrain camera to map boundaries taking zoom into account
  var halfViewWidth = width / (2 * camera.zoom);
  var halfViewHeight = height / (2 * camera.zoom);
  camera.position.x = constrain(camera.position.x, halfViewWidth, mapPixelWidth - halfViewWidth);
  camera.position.y = constrain(camera.position.y, halfViewHeight, mapPixelHeight - halfViewHeight);
  
  // Adjust camera zoom based on player's position
  if (player.position.x > 3000) {
    let newZoom = map(player.position.x, 5000, 5200, 1, 0.5);
    camera.zoom = constrain(newZoom, 0.5, 0.9);
  } else {
    camera.zoom = 0.9;
  }
  
  // Spawn obstacles at random intervals between 5 to 8 seconds
  if (millis() > nextObstacleSpawnTime) {
    spawnObstacle();
    nextObstacleSpawnTime = millis() + random(500, 7000);
  }
  
  // Decrement hit cooldown if active
  if (hitCooldown > 0) {
    hitCooldown--;
  }
  
  // Handle obstacle collisions (only process when cooldown is inactive)
  if (gameState === "play" && hitCooldown <= 0) {
    obstacleGroup.overlap(player, function(obstacleSprite, playerSprite) {
      if (!obstacleSprite.collided) {
        obstacleSprite.collided = true;
        if (player.scale > 0.5) {
          player.scale = 0.5;
          hitCooldown = 30; // 30 frames invincibility
        } else {
          playerDies();
        }
        obstacleSprite.remove();
      }
    });
  }
  
  // Handle banana collisions: when player touches a banana, restore full size (0.9) and remove banana
  bananaGroup.overlap(player, function(bananaSprite, playerSprite) {
    player.scale = 0.9;
    bananaSprite.remove();
  });
  
  // If player falls off the map, trigger game over
  if (player.position.y > mapPixelHeight + 100) {
    playerDies();
  }
  
  drawSprites();
  camera.off();

  fill(255);
  textSize(16);
  text("Player X: " + player.position.x.toFixed(0) + "   Y: " + player.position.y.toFixed(0), 150, 50);

  // Optionally, turn the camera back on for further drawing
  camera.on()
}

// -----------------------------
// SPAWN OBSTACLE
// -----------------------------
function spawnObstacle() {
  var obstacleHeight = 40;
  var maxAttempts = 10;
  var validSpawn = false;
  var obstacleX, spawnY;
  
  // Try up to maxAttempts times to find a spawn location that does not overlap a tile.
  for (var i = 0; i < maxAttempts; i++) {
    var direction = (random() < 0.5) ? -1 : 1;
    var offset = random(500, 600) * direction;
    obstacleX = player.position.x + offset;
    spawnY = player.position.y;
    var temp = createSprite(obstacleX, spawnY, 10, obstacleHeight);
    if (!temp.overlap(tileGroup)) {
      validSpawn = true;
      temp.remove();
      break;
    }
    temp.remove();
  }
  
  if (validSpawn) {
    var obstacle = createSprite(obstacleX, spawnY, 10, obstacleHeight);
    obstacle.addImage(obstacleImage);
    obstacle.scale = 0.08;
    obstacleGroup.add(obstacle);
  }
}

// -----------------------------
// PLAYER DEATH & RESET FUNCTIONS
// -----------------------------
function playerDies() {
  gameState = "gameover";
  player.velocity.x = 0;
  player.velocity.y = 0;
}

function resetGame() {
  player.position.x = 200;
  player.position.y = 1040;
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.scale = 0.9;
  player.changeAnimation("idle");
  obstacleGroup.removeSprites();
  bananaGroup.removeSprites();
  // Re-spawn bananas at fixed positions:
  spawnBananas();
  gameState = "play";
}

function returnToMainMenu() {
  player.position.x = 200;
  player.position.y = 1040;
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.scale = 0.9;
  player.changeAnimation("idle");
  obstacleGroup.removeSprites();
  bananaGroup.removeSprites();
  // Re-spawn bananas at fixed positions:
  spawnBananas();
  gameState = "start";
}


// -----------------------------
// MOUSE PRESSED - Start Game
// -----------------------------
function mousePressed() {
  if (gameState === "start") {
    gameState = "play";
  }
}

// -----------------------------
// KEY PRESSED - Handle Game Over Options
// -----------------------------
function keyPressed() {
  if (gameState === "gameover") {
    if (key === "r" || key === "R") {
      resetGame();
    }
    if (key === "m" || key === "M") {
      returnToMainMenu();
    }
  }
}
