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
