import * as THREE from "three";

// ==========================================
// RUGBY CLASH - PROTOTYPE V0.1
// ==========================================

// CONFIGURATION

const FIELD_WIDTH = 70;
const FIELD_LENGTH = 120;
const MATCH_DURATION = 180;

let running = false;
let score = 0;
let opponentScore = 0;
let timeLeft = MATCH_DURATION;
let difficulty = 1;
let carrier = null;
let messageTimer = 0;
let tackleCooldown = 0;

const difficultySettings = [
    { speed: 3.5, tackle: 1.2 },
    { speed: 4.5, tackle: 1.6 },
    { speed: 5.2, tackle: 2.0 },
    { speed: 5.8, tackle: 2.4 },
    { speed: 6.5, tackle: 2.8 }
];

// SCÈNE THREE.JS

const container = document.getElementById("game");

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x8eb5d0);
scene.fog = new THREE.Fog(0x8eb5d0, 90, 180);

const camera = new THREE.PerspectiveCamera(
    48,
    window.innerWidth / window.innerHeight,
    0.1,
    300
);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.5)
);

renderer.outputColorSpace = THREE.SRGBColorSpace;

container.insertBefore(
    renderer.domElement,
    container.firstChild
);

// ÉCLAIRAGE

const ambient = new THREE.HemisphereLight(
    0xffffff,
    0x42613d,
    2
);

scene.add(ambient);

const sunlight = new THREE.DirectionalLight(
    0xffffff,
    2
);

sunlight.position.set(-30, 60, -30);
scene.add(sunlight);

// TERRAIN

const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(
        FIELD_WIDTH,
        FIELD_LENGTH
    ),
    new THREE.MeshStandardMaterial({
        color: 0x397b38,
        roughness: 1
    })
);

grass.rotation.x = -Math.PI / 2;
scene.add(grass);

// LIGNES DU TERRAIN

function createLine(x1, z1, x2, z2, color = 0xffffff) {

    const length = Math.hypot(
        x2 - x1,
        z2 - z1
    );

    const geometry = new THREE.BoxGeometry(
        x1 === x2 ? 0.15 : length,
        0.035,
        z1 === z2 ? 0.15 : length
    );

    const line = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color })
    );

    line.position.set(
        (x1 + x2) / 2,
        0.035,
        (z1 + z2) / 2
    );

    scene.add(line);
}

createLine(-35, -50, 35, -50);
createLine(-35, 50, 35, 50);
createLine(-35, -50, -35, 50);
createLine(35, -50, 35, 50);

createLine(-35, 0, 35, 0);

createLine(-35, -28, 35, -28, 0xe5eabf);
createLine(-35, 28, 35, 28, 0xe5eabf);

createLine(-35, -5, 35, -5, 0xe5eabf);
createLine(-35, 5, 35, 5, 0xe5eabf);

// EN-BUTS

function createGoal(z) {

    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff
    });

    const centralPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 12, 10),
        material
    );

    centralPost.position.set(0, 6, z);
    scene.add(centralPost);

    for (const x of [-3.5, 3.5]) {

        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.16, 8, 10),
            material
        );

        post.position.set(x, 4, z);
        scene.add(post);
    }

    const crossbar = new THREE.Mesh(
        new THREE.BoxGeometry(7, 0.2, 0.2),
        material
    );

    crossbar.position.set(0, 4, z);
    scene.add(crossbar);
}

// Création des deux en-buts

createGoal(-55);
createGoal(55);

// TRIBUNES

const standMaterial = new THREE.MeshStandardMaterial({
    color: 0x263e39
});

for (const side of [-1, 1]) {

    for (let row = 0; row < 4; row++) {

        const stand = new THREE.Mesh(
            new THREE.BoxGeometry(120, 1.8, 3),
            standMaterial
        );

        stand.position.set(
            side * 42,
            1.8 + row * 1.6,
            0
        );

        scene.add(stand);
    }
}

// JOUEURS

const attackers = [];
const defenders = [];

const redMaterial = new THREE.MeshStandardMaterial({
    color: 0xc52e36,
    roughness: 0.75
});

const blueMaterial = new THREE.MeshStandardMaterial({
    color: 0x245cce,
    roughness: 0.75
});

const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9a27d
});

const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x171b1b
});

const bodyGeometry = new THREE.CapsuleGeometry(
    0.38,
    0.85,
    4,
    8
);

function createPlayer(x, z, team, index) {

    const group = new THREE.Group();

    const body = new THREE.Mesh(
        bodyGeometry,
        team === 0 ? redMaterial : blueMaterial
    );

    body.position.y = 1.05;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 8),
        skinMaterial
    );

    head.position.y = 1.9;
    group.add(head);

    const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.55, 0.35),
        darkMaterial
    );

    legs.position.y = 0.3;
    group.add(legs);

    group.position.set(x, 0, z);

    scene.add(group);

    const player = {
        group,
        team,
        index,
        x,
        z,
        targetX: x,
        targetZ: z,
        speed: 5
    };

    if (team === 0) {
        attackers.push(player);
    } else {
        defenders.push(player);
    }

    return player;
}

// CRÉATION DES 30 JOUEURS

function createTeams() {

    for (let i = 0; i < 15; i++) {

        const lane = (i % 5 - 2) * 5;
        const row = Math.floor(i / 5);

        createPlayer(lane, -37 - row * 3, 0, i);
        createPlayer(lane, -18 + row * 5, 1, i);
    }
}

createTeams();

// BALLON

const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    new THREE.MeshStandardMaterial({
        color: 0x9a572b,
        roughness: 0.8
    })
);

ball.scale.set(0.85, 0.75, 1.4);
scene.add(ball);

carrier = attackers[7];

function updateBall() {

    if (!carrier) return;

    ball.position.set(
        carrier.x,
        1.3,
        carrier.z + 0.6
    );

    ball.rotation.x += 0.01;
}
// ==========================================
// COMMANDES CLAVIER
// ==========================================

const keys = {};

window.addEventListener("keydown", event => {
    keys[event.key.toLowerCase()] = true;

    if (event.code === "Space") {
        event.preventDefault();
        passBall();
    }
});

window.addEventListener("keyup", event => {
    keys[event.key.toLowerCase()] = false;
});

const keyboardInput = {
    x: 0,
    y: 0,
    sprint: false
};

function readKeyboard() {
    keyboardInput.x = 0;
    keyboardInput.y = 0;

    if (keys["arrowleft"] || keys["q"] || keys["a"])
        keyboardInput.x--;

    if (keys["arrowright"] || keys["d"])
        keyboardInput.x++;

    if (keys["arrowup"] || keys["z"] || keys["w"])
        keyboardInput.y++;

    if (keys["arrowdown"] || keys["s"])
        keyboardInput.y--;

    keyboardInput.sprint = !!keys["shift"];
}

// ==========================================
// COMMANDES TACTILES
// ==========================================

const joystick = document.getElementById("joystick");
const knob = document.getElementById("joystick-knob");

const touchInput = {
    x: 0,
    y: 0,
    sprint: false
};

let joystickPointer = null;

function updateJoystick(event) {
    const rect = joystick.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const max = 32;
    const distance = Math.hypot(dx, dy);

    if (distance > max) {
        dx = dx / distance * max;
        dy = dy / distance * max;
    }

    touchInput.x = dx / max;
    touchInput.y = -dy / max;

    knob.style.transform = `translate(${dx}px, ${dy}px)`;
}

joystick.addEventListener("pointerdown", event => {
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
});

joystick.addEventListener("pointermove", event => {
    if (event.pointerId === joystickPointer) {
        updateJoystick(event);
    }
});

function releaseJoystick(event) {
    if (event.pointerId !== joystickPointer) return;

    joystickPointer = null;
    touchInput.x = 0;
    touchInput.y = 0;

    knob.style.transform = "translate(0,0)";
}

joystick.addEventListener("pointerup", releaseJoystick);
joystick.addEventListener("pointercancel", releaseJoystick);

// ==========================================
// SPRINT
// ==========================================

const sprintButton = document.getElementById("sprint-button");

sprintButton.addEventListener("pointerdown", event => {
    touchInput.sprint = true;
    sprintButton.setPointerCapture(event.pointerId);
});

function releaseSprint() {
    touchInput.sprint = false;
}

sprintButton.addEventListener("pointerup", releaseSprint);
sprintButton.addEventListener("pointercancel", releaseSprint);
sprintButton.addEventListener("lostpointercapture", releaseSprint);

// ==========================================
// ENTRÉES DU JOUEUR
// ==========================================

const input = {
    x: 0,
    y: 0,
    sprint: false
};

function updateInput() {
    const touchActive =
        Math.hypot(touchInput.x, touchInput.y) > 0.05;

    input.x = touchActive ? touchInput.x : keyboardInput.x;
    input.y = touchActive ? touchInput.y : keyboardInput.y;

    input.sprint =
        touchInput.sprint || keyboardInput.sprint;
}

// ==========================================
// PASSES
// ==========================================

function passBall() {
    if (!running || !carrier) return;

    const options = attackers.filter(player =>
        player !== carrier &&
        player.z >= carrier.z - 12 &&
        Math.abs(player.x - carrier.x) < 25
    );

    if (options.length === 0) return;

    options.sort((a, b) => {
        const da = Math.hypot(
            a.x - carrier.x,
            a.z - carrier.z
        );

        const db = Math.hypot(
            b.x - carrier.x,
            b.z - carrier.z
        );

        return da - db;
    });

    carrier = options[0];

    showMessage("PASSE !");
}

document.getElementById("pass-button").addEventListener(
    "pointerdown",
    event => {
        event.preventDefault();
        passBall();
    }
);

// ==========================================
// DÉPLACEMENT DES JOUEURS
// ==========================================

function movePlayer(player, dt) {
    const dx = player.targetX - player.x;
    const dz = player.targetZ - player.z;

    const distance = Math.hypot(dx, dz);

    if (distance < 0.05) return;

    const step = Math.min(
        player.speed * dt,
        distance
    );

    player.x += dx / distance * step;
    player.z += dz / distance * step;

    player.group.position.set(
        player.x,
        0,
        player.z
    );

    player.group.rotation.y = Math.atan2(dx, dz);
}

// ==========================================
// DÉPLACEMENT DU PORTEUR
// ==========================================

function updateUser(dt) {
    if (!carrier) return;

    const length = Math.hypot(input.x, input.y);
    const factor = length > 1 ? 1 / length : 1;
    const speed = input.sprint ? 10 : 7;

    carrier.x += input.x * factor * speed * dt;
    carrier.z += input.y * factor * speed * dt;

    carrier.x = THREE.MathUtils.clamp(carrier.x, -32, 32);
    carrier.z = THREE.MathUtils.clamp(carrier.z, -59, 59);

    carrier.group.position.set(
        carrier.x,
        0,
        carrier.z
    );

    if (length > 0.1) {
        carrier.group.rotation.y = Math.atan2(
            input.x,
            input.y
        );
    }
}

// ==========================================
// INTELLIGENCE ARTIFICIELLE DÉFENSIVE
// ==========================================

function updateAI(dt) {
    if (!carrier) return;

    const settings = difficultySettings[difficulty];

    for (const defender of defenders) {
        defender.targetX = carrier.x;
        defender.targetZ = carrier.z;
        defender.speed = settings.speed;

        movePlayer(defender, dt);
    }
}

// ==========================================
// DÉPLACEMENT DES COÉQUIPIERS
// ==========================================

function updateTeammates(dt) {
    if (!carrier) return;

    for (const player of attackers) {
        if (player === carrier) continue;

        const lane = (player.index % 5 - 2) * 5;

        player.targetX = THREE.MathUtils.clamp(
            carrier.x + lane,
            -30,
            30
        );

        player.targetZ = Math.max(
            -40,
            carrier.z - 4 - Math.floor(player.index / 5) * 3
        );

        player.speed = 5.5;

        movePlayer(player, dt);
    }
}

// ==========================================
// PLAQUAGES
// ==========================================

function checkTackles(dt) {
    tackleCooldown -= dt;

    if (tackleCooldown > 0 || !carrier) return;

    const settings = difficultySettings[difficulty];

    for (const defender of defenders) {
        const distance = Math.hypot(
            defender.x - carrier.x,
            defender.z - carrier.z
        );

        if (distance < settings.tackle) {
            carrier.z -= 3;

            carrier.x += Math.random() > 0.5 ? 2 : -2;

            carrier.x = THREE.MathUtils.clamp(
                carrier.x,
                -30,
                30
            );

            carrier.group.position.set(
                carrier.x,
                0,
                carrier.z
            );

            tackleCooldown = 2.2;

            showMessage("PLAQUAGE !");

            break;
        }
    }
}

// ==========================================
// REMISE EN JEU
// ==========================================

function resetFormation() {
    for (let i = 0; i < 15; i++) {
        const lane = (i % 5 - 2) * 5;
        const row = Math.floor(i / 5);

        const attacker = attackers[i];
        const defender = defenders[i];

        attacker.x = lane;
        attacker.z = -37 - row * 3;

        defender.x = lane;
        defender.z = -18 + row * 5;

        attacker.group.position.set(
            attacker.x,
            0,
            attacker.z
        );

        defender.group.position.set(
            defender.x,
            0,
            defender.z
        );
    }

    carrier = attackers[7];
    tackleCooldown = 2;
}
// ==========================================
// ESSAIS
// ==========================================

function checkTry() {
    if (!carrier) return;

    if (carrier.z >= 50) {
        score += 5;

        document.getElementById("player-score").textContent = score;

        showMessage("ESSAI ! +5");

        resetFormation();
    }
}

// ==========================================
// CAMÉRA 3D
// ==========================================

const cameraTarget = new THREE.Vector3();

function updateCamera(dt) {
    if (!carrier) return;

    const desired = new THREE.Vector3(
        carrier.x * 0.65,
        17,
        carrier.z - 23
    );

    camera.position.lerp(
        desired,
        Math.min(1, dt * 3)
    );

    cameraTarget.set(
        carrier.x,
        0,
        carrier.z + 12
    );

    camera.lookAt(cameraTarget);
}

// ==========================================
// MESSAGES À L'ÉCRAN
// ==========================================

function showMessage(text) {
    const element = document.getElementById("game-message");

    element.textContent = text;

    messageTimer = 1.5;
}

// ==========================================
// CHRONOMÈTRE
// ==========================================

function updateClock(dt) {
    if (!running) return;

    timeLeft -= dt;

    if (timeLeft <= 0) {
        timeLeft = 0;
        running = false;

        let result = "MATCH NUL !";

        if (score > opponentScore) {
            result = "VICTOIRE !";
        }

        if (score < opponentScore) {
            result = "DÉFAITE !";
        }

        showMessage(result);

        setTimeout(() => {
            document.getElementById("start-screen").style.display = "flex";

            document.getElementById("start-button").textContent = "REJOUER";
        }, 1800);
    }

    const minutes = Math.floor(timeLeft / 60);
    const seconds = Math.floor(timeLeft % 60);

    document.getElementById("timer").textContent =
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");
}

// ==========================================
// LANCEMENT DU MATCH
// ==========================================

document.getElementById("start-button").addEventListener("click", () => {
    difficulty = parseInt(
        document.getElementById("difficulty").value,
        10
    );

    score = 0;
    opponentScore = 0;
    timeLeft = MATCH_DURATION;

    document.getElementById("player-score").textContent = "0";
    document.getElementById("opponent-score").textContent = "0";
    document.getElementById("timer").textContent = "03:00";

    resetFormation();

    document.getElementById("start-screen").style.display = "none";

    running = true;

    showMessage("COUP D'ENVOI !");
});

// ==========================================
// BOUCLE PRINCIPALE DU JEU
// ==========================================

let previousTime = performance.now();

function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min(
        (now - previousTime) / 1000,
        0.05
    );

    previousTime = now;

    if (running) {
        readKeyboard();
        updateInput();

        updateUser(dt);
        updateAI(dt);
        updateTeammates(dt);

        checkTackles(dt);
        checkTry();

        updateBall();
        updateClock(dt);

        if (messageTimer > 0) {
            messageTimer -= dt;

            if (messageTimer <= 0) {
                document.getElementById("game-message").textContent = "";
            }
        }
    }

    updateCamera(dt);

    renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// ==========================================
// REDIMENSIONNEMENT DE L'ÉCRAN
// ==========================================

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 1.5)
    );
});
