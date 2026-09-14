// Runner 3D - jeu d'arcade en 3D avec Three.js
// L'univers défile vers le joueur ; le joueur change de voie et saute/glisse.

(() => {
  const LANE_X = [-2.2, 0, 2.2];
  const GRAVITY = -30;
  const JUMP_SPEED = 11;
  const LANE_SWITCH_SPEED = 14; // vitesse de translation latérale
  const START_SPEED = 12;
  const MAX_SPEED = 34;
  const SPEED_RAMP = 0.12; // unités/s^2
  const SPAWN_Z = -80;
  const DESPAWN_Z = 8;
  const SEGMENT_LENGTH = 6;

  let renderer, scene, camera;
  let player, playerMixerState;
  let clock;
  let obstacles = [];
  let coins = [];
  let lane = 1; // index 0,1,2 -> voie actuelle cible
  let playerX = LANE_X[1];
  let velocityY = 0;
  let isGrounded = true;
  let isSliding = false;
  let slideTimer = 0;
  let speed = START_SPEED;
  let distance = 0;
  let score = 0;
  let best = Number(localStorage.getItem('runner3d-best') || 0);
  let running = false;
  let gameOver = false;

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const finalScoreEl = document.getElementById('final-score');

  bestEl.textContent = `Meilleur : ${best}`;

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.Fog(0x0a0e1a, 20, 70);

    camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    camera.position.set(0, 5.2, 9);
    camera.lookAt(0, 1, -10);

    renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('game-canvas'),
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    const hemi = new THREE.HemisphereLight(0x8fb3ff, 0x1a1508, 0.9);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
    sun.position.set(-6, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);

    buildTrack();
    buildPlayer();

    clock = new THREE.Clock();

    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);

    document.getElementById('btn-left').addEventListener('click', () => moveLane(-1));
    document.getElementById('btn-right').addEventListener('click', () => moveLane(1));
    document.getElementById('btn-jump').addEventListener('click', jump);

    animate();
  }

  function buildTrack() {
    const trackGeo = new THREE.PlaneGeometry(8, 200);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1c2333, roughness: 0.9 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, 0, -90);
    track.receiveShadow = true;
    scene.add(track);

    // lignes de voie
    for (const x of [-1.1, 1.1]) {
      const lineGeo = new THREE.PlaneGeometry(0.08, 200);
      const lineMat = new THREE.MeshStandardMaterial({
        color: 0x3a4a6b,
        emissive: 0x1a2440,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.01, -90);
      scene.add(line);
    }

    // bordures lumineuses
    for (const x of [-4.1, 4.1]) {
      const wallGeo = new THREE.BoxGeometry(0.2, 0.6, 200);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x2e3a5c,
        emissive: 0x4a6dff,
        emissiveIntensity: 0.4,
      });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x, 0.3, -90);
      scene.add(wall);
    }
  }

  function buildPlayer() {
    const group = new THREE.Group();

    const bodyGeo = new THREE.CapsuleGeometry(0.45, 0.6, 6, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff5d5d, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.75;
    body.castShadow = true;
    group.add(body);

    const headGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd8b0, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    head.castShadow = true;
    group.add(head);

    group.position.set(playerX, 0, 0);
    scene.add(group);
    player = group;
  }

  function makeObstacle(z, laneIdx) {
    const geo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a3ffb, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(LANE_X[laneIdx], 0.65, z);
    mesh.castShadow = true;
    scene.add(mesh);
    obstacles.push(mesh);
  }

  function makeLowBar(z, laneIdx) {
    // obstacle qu'on doit sauter (barre au sol)
    const geo = new THREE.BoxGeometry(1.6, 0.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff8a3f, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(LANE_X[laneIdx], 0.25, z);
    mesh.castShadow = true;
    mesh.userData.type = 'jumpOver';
    scene.add(mesh);
    obstacles.push(mesh);
  }

  function makeHighBar(z, laneIdx) {
    // obstacle qu'on doit éviter en glissant
    const geo = new THREE.BoxGeometry(1.6, 0.4, 0.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3fd1ff, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(LANE_X[laneIdx], 1.5, z);
    mesh.castShadow = true;
    mesh.userData.type = 'slideUnder';
    scene.add(mesh);
    obstacles.push(mesh);
  }

  function makeCoin(z, laneIdx, yOffset = 1) {
    const geo = new THREE.TorusGeometry(0.35, 0.14, 8, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd75e,
      emissive: 0x7a5a00,
      metalness: 0.6,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(LANE_X[laneIdx], yOffset, z);
    mesh.castShadow = true;
    scene.add(mesh);
    coins.push(mesh);
  }

  function spawnSegment(z) {
    const pattern = Math.random();
    const laneIdx = Math.floor(Math.random() * 3);

    if (pattern < 0.28) {
      makeObstacle(z, laneIdx);
    } else if (pattern < 0.5) {
      makeLowBar(z, laneIdx);
    } else if (pattern < 0.7) {
      makeHighBar(z, laneIdx);
    }

    // pièces : soit une ligne dans une voie libre, soit un arc
    if (Math.random() < 0.75) {
      const coinLane = Math.random() < 0.5 ? (laneIdx + 1) % 3 : (laneIdx + 2) % 3;
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        makeCoin(z - i * 1.4, coinLane);
      }
    }
  }

  function resetWorld() {
    for (const o of obstacles) scene.remove(o);
    for (const c of coins) scene.remove(c);
    obstacles = [];
    coins = [];
    lane = 1;
    playerX = LANE_X[1];
    velocityY = 0;
    isGrounded = true;
    isSliding = false;
    slideTimer = 0;
    speed = START_SPEED;
    distance = 0;
    score = 0;
    player.position.set(playerX, 0, 0);
    player.scale.set(1, 1, 1);
    updateScoreDisplay();

    for (let z = -20; z > SPAWN_Z; z -= SEGMENT_LENGTH) {
      spawnSegment(z);
    }
  }

  function startGame() {
    resetWorld();
    running = true;
    gameOver = false;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    clock.getDelta();
  }

  function endGame() {
    running = false;
    gameOver = true;
    if (score > best) {
      best = score;
      localStorage.setItem('runner3d-best', String(best));
      bestEl.textContent = `Meilleur : ${best}`;
    }
    finalScoreEl.textContent = `Score : ${score}`;
    gameOverScreen.classList.remove('hidden');
  }

  function moveLane(dir) {
    if (!running) return;
    const newLane = lane + dir;
    if (newLane < 0 || newLane > 2) return;
    lane = newLane;
  }

  function jump() {
    if (!running) return;
    if (isGrounded && !isSliding) {
      velocityY = JUMP_SPEED;
      isGrounded = false;
    }
  }

  function slide() {
    if (!running) return;
    if (isGrounded) {
      isSliding = true;
      slideTimer = 0.6;
      player.scale.set(1, 0.5, 1);
    }
  }

  function onKeyDown(e) {
    if ((e.code === 'Enter' || e.code === 'Space') && !running && !gameOver) {
      startGame();
      return;
    }
    if ((e.code === 'Enter' || e.code === 'Space') && gameOver) {
      startGame();
      return;
    }
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        moveLane(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveLane(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        jump();
        break;
      case 'ArrowDown':
      case 'KeyS':
        slide();
        break;
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function updateScoreDisplay() {
    scoreEl.textContent = `Score : ${score}`;
  }

  function boxIntersect(a, b, sizeA, sizeB) {
    return (
      Math.abs(a.x - b.x) < (sizeA.x + sizeB.x) / 2 &&
      Math.abs(a.y - b.y) < (sizeA.y + sizeB.y) / 2 &&
      Math.abs(a.z - b.z) < (sizeA.z + sizeB.z) / 2
    );
  }

  function update(dt) {
    if (!running) return;

    // vitesse progressive
    speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * dt * 10);
    distance += speed * dt;
    score = Math.floor(distance);

    // déplacement latéral fluide vers la voie cible
    const targetX = LANE_X[lane];
    playerX += Math.sign(targetX - playerX) * Math.min(Math.abs(targetX - playerX), LANE_SWITCH_SPEED * dt);

    // saut
    if (!isGrounded) {
      velocityY += GRAVITY * dt;
      player.position.y += velocityY * dt;
      if (player.position.y <= 0) {
        player.position.y = 0;
        velocityY = 0;
        isGrounded = true;
      }
    }

    // glissade
    if (isSliding) {
      slideTimer -= dt;
      if (slideTimer <= 0) {
        isSliding = false;
        player.scale.set(1, 1, 1);
      }
    }

    player.position.x = playerX;
    player.rotation.z = (targetX - playerX) * -0.15;

    // faire défiler les obstacles/pièces vers le joueur
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.position.z += speed * dt;
      o.rotation.y += dt * (o.userData.type ? 0 : 1.2);

      if (o.position.z > DESPAWN_Z) {
        scene.remove(o);
        obstacles.splice(i, 1);
        continue;
      }

      // collision
      const playerBox = { x: 0.7, y: isSliding ? 0.6 : 1.5, z: 0.7 };
      const playerPos = { x: player.position.x, y: player.position.y + playerBox.y / 2, z: player.position.z };
      let obsBox = { x: 1.2, y: 1.2, z: 1.2 };
      let obsPos = { x: o.position.x, y: o.position.y, z: o.position.z };

      if (o.userData.type === 'jumpOver') {
        obsBox = { x: 1.5, y: 0.5, z: 0.5 };
        // esquivable en sautant : si le joueur est assez haut, pas de collision
        if (player.position.y > 0.55) continue;
      } else if (o.userData.type === 'slideUnder') {
        obsBox = { x: 1.5, y: 0.4, z: 0.4 };
        // esquivable en glissant
        if (isSliding) continue;
      }

      if (boxIntersect(playerPos, obsPos, playerBox, obsBox)) {
        endGame();
      }
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.position.z += speed * dt;
      c.rotation.y += dt * 3;

      if (c.position.z > DESPAWN_Z) {
        scene.remove(c);
        coins.splice(i, 1);
        continue;
      }

      const dx = c.position.x - player.position.x;
      const dz = c.position.z - player.position.z;
      const dy = c.position.y - (player.position.y + 0.8);
      if (Math.abs(dx) < 0.7 && Math.abs(dz) < 0.7 && Math.abs(dy) < 0.9) {
        scene.remove(c);
        coins.splice(i, 1);
        score += 10;
      }
    }

    updateScoreDisplay();

    // légère avance de caméra pour donner de la vitesse ressentie
    camera.position.x += (player.position.x * 0.3 - (camera.position.x - 0)) * 0.05;
    camera.lookAt(player.position.x * 0.5, 1, -10);
  }

  let spawnAccumulator = 0;

  function updateSpawning(dt) {
    if (!running) return;
    spawnAccumulator += speed * dt;
    if (spawnAccumulator >= SEGMENT_LENGTH) {
      spawnAccumulator = 0;
      spawnSegment(SPAWN_Z);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    update(dt);
    updateSpawning(dt);
    renderer.render(scene, camera);
  }

  init();
})();
