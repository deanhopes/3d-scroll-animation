import "./style.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// Register GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// Initialize Lenis smooth scroll
const lenis = new Lenis();
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// Initialize Three.js
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfefdfd);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xffffff, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 3.0;
document.querySelector(".model").appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1);
fillLight.position.set(-10, -10, -10);
scene.add(fillLight);

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x080808, 3);
hemisphereLight.position.set(0, 10, 0);
scene.add(hemisphereLight);

let animationFrameId;

function basicAnimate() {
  animationFrameId = requestAnimationFrame(basicAnimate);
  renderer.render(scene, camera);
}

basicAnimate();

function animate() {
  animationFrameId = requestAnimationFrame(animate);

  if (model && isFloating) {
    const time = Date.now() * 0.001; // Convert to seconds
    model.position.y = Math.sin(time * floatFrequency) * floatAmplitude;
    model.rotation.y += rotationSpeed * 0.01;
  }

  renderer.render(scene, camera);
}

// Load the model
let model;

const loader = new GLTFLoader();

// Add these declarations after scene setup and before the loader
const scannerSection = document.querySelector(".scanner");
const scanContainer = scannerSection.querySelector(".scan-container");
const scanSound = new Audio("./scan.wav");

loader.load("./josta.glb", function (gltf) {
  model = gltf.scene;
  model.traverse((node) => {
    if (node.isMesh) {
      if (node.material) {
        node.material.metalness = 0.9;
        node.material.roughness = 0.5;
        node.material.envMapIntensity = 1.5;
      }
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  scene.add(model);

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 280 / maxDim; // 280 is scan-container width
  model.scale.setScalar(scale * 0.8); // 80% of container size
  camera.position.z = maxDim * 2;

  // model.scale.set(0, 0, 0);
  playInitalAnimation();

  cancelAnimationFrame(animationFrameId);
  animate();

  const stickyHeight = window.innerHeight;

  gsap.set(scanContainer, {
    scale: 0,
  });

  ScrollTrigger.create({
    trigger: ".scanner",
    start: "top top",
    end: "100%",
    pin: true,
    pinSpacing: true,
    anticipatePin: 1,
    markers: true,
    id: "scanner",
    onEnter: () => {
      if (!model) return;

      lenis.setVelocity(0);
      gsap.to(lenis, {
        duration: 0.5,
        scrollSpeed: 0,
        ease: "power2.out",
        onComplete: () => lenis.stop()
      });

      isFloating = false;

      gsap.timeline({
        defaults: { ease: "power2.inOut" }
      })
        .to(model.position, {
          y: 0,
          duration: 0.5
        })
        .to(model.rotation, {
          y: model.rotation.y + Math.PI * 2,
          duration: 1.5
        })
        .add(() => {
          scanSound.currentTime = 0;
          scanSound.play();
        })
        .to(model.scale, {
          x: 0,
          y: 0,
          z: 0,
          duration: 0.8
        })
        .to(scanContainer, {
          scale: 0,
          duration: 1,
          onComplete: () => {
            lenis.start();
            gsap.to(lenis, {
              duration: 0.5,
              scrollSpeed: 1,
              ease: "power2.in"
            });
          }
        });
    },
    onLeaveBack: () => {
      if (!model) return;
      isFloating = true;
      playInitalAnimation();
    }
  });
});

const floatAmplitude = 0.05;
const floatFrequency = 1.5;
const rotationSpeed = 0.25;

let isFloating = true;
let currentScroll = 0;

function playInitalAnimation() {
  if (model) {
    gsap.to(model.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1,
      ease: "power2.inOut",
    });
  }
  gsap.to(scanContainer, {
    scale: 1,
    duration: 1,
    ease: "power2.inOut",
  });
}

// Update the RGBE loader implementation
const rgbeLoader = new RGBELoader();
rgbeLoader.setPath('/');  // Make sure this path is correct for your project structure
rgbeLoader.load(
  'studio_small_09_2k.hdr',  // Make sure this file exists and the name is exact
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;

    // Update renderer settings
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.5;
    renderer.outputColorSpace = THREE.SRGBColorSpace;  // Updated from outputEncoding
  },
  // Progress callback
  (progress) => {
    console.log('Loading HDR:', (progress.loaded / progress.total * 100) + '%');
  },
  // Error callback
  (error) => {
    console.error('Error loading HDR:', error);
    // Fallback to a basic environment
    scene.environment = null;
    renderer.toneMapping = THREE.NoToneMapping;
  }
);

