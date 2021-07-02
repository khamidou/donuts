var windowWidth = window.innerWidth;
var windowHeight = window.innerHeight;

function drawDonut() {
  let A = 0;
  let B = 0;
  let K1 = 200;
  let K2 = 600;

  let circle_radius = 50;
  let torus_radius = 200;

  // We have to do these intricate scaling hacks because the canvas API
  // doesn't know about hidpi displays:
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
  var canvas = document.getElementById("donutCanvas");

  canvas.style.width = windowWidth + "px";
  canvas.style.height = windowHeight + "px";

  var windowScale = window.devicePixelRatio;
  canvas.width = Math.floor(windowWidth * windowScale);
  canvas.height = Math.floor(windowHeight * windowScale);

  var offscreenCanvas = new OffscreenCanvas(2.5 * torus_radius, 2.5 * torus_radius);

  offscreenCanvas.width = 3 * torus_radius;
  offscreenCanvas.height = canvas.height;

  let donutTexture = new Image();

  var ctx = canvas.getContext("2d", { alpha: false });
  var offscreenCtx = offscreenCanvas.getContext("2d", { alpha: false });

  let startTimestamp = null;

  function doDrawTorus() {
    A += 0.01;
    B += 0.02;

    let start_x = offscreenCanvas.width / 2;
    let start_y = offscreenCanvas.height / 2;

    var zbuffer = new Array();

    offscreenCtx.fillStyle = 'black';
    offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    offscreenCtx.fillStyle = 'salmon';

    function compute_next_x(A, B, torus_radius, circle_radius, theta, phi, canvas) {
        return (torus_radius + circle_radius * Math.cos(theta)) *
               (Math.cos(B) *  Math.cos(phi) + Math.sin(A) * Math.sin(B) * Math.sin(phi)) -
               circle_radius * Math.cos(A) * Math.sin(B) * Math.sin(theta) + offscreenCanvas.width / 2;
    }

    function compute_next_y(A, B, torus_radius, circle_radius, theta, phi, canvas) {
        return (torus_radius + circle_radius * Math.cos(theta)) *
               (Math.cos(phi) * Math.sin(B) - Math.cos(B) * Math.sin(A) * Math.sin(phi)) +
               (circle_radius * Math.cos(A) * Math.cos(B) * Math.sin(theta)) + offscreenCanvas.height / 2;
    }

    function compute_next_z(A, torus_radius, circle_radius, theta, phi) {
      return Math.cos(A) * (torus_radius + circle_radius * Math.cos(theta)) * Math.sin(phi) +
                            circle_radius * Math.sin(A) * Math.sin(theta);
    }

    function compute_map_texture_x(torus_radius, circle_radius, theta, phi) {
      // we need to compute the inverse matrix from the previous transform to map to the formula
      // https://www.wolframalpha.com/input/?i=inv%7B%7BCos%5BP%5D%2C+0%2C+Sin%5BP%5D%7D%2C+%7B0%2C+1%2C+0%7D%2C+%7B-Sin%5BP%5D%2C+0%2C+Cos%5BP%5D%7D%7D
      // result applied to our coords: https://www.wolframalpha.com/input/?i=matrix+multiplication+calculator&assumption=%7B%22F%22%2C+%22MatricesOperations%22%2C+%22theMatrix2%22%7D+-%3E%22%7B%7BCos%5BP%5D%2C+0%2C+-Sin%5BP%5D%7D%2C+%7B0%2C+1%2C+0%7D%2C+%7BSin%5BP%5D%2C+0%2C+Cos%5BP%5D%7D%7D%22&assumption=%7B%22F%22%2C+%22MatricesOperations%22%2C+%22theMatrix1%22%7D+-%3E%22%7Bx%2C+y%2C+z%7D%22
      return Math.abs(((torus_radius + circle_radius * Math.cos(theta)) * Math.cos(phi) +
               0 * Math.sin(phi)));
    }

    function compute_map_texture_y(torus_radius, circle_radius, theta, phi) {
      // turns out it's the identity function:
      return Math.abs(circle_radius * Math.sin(theta));
    }

    function compute_luminance(A, B, theta, phi) {
      return (Math.cos(phi) * Math.cos(theta) * Math.sin(B) - Math.cos(A) * Math.cos(theta) * Math.sin(phi) -
              Math.sin(A) * Math.sin(theta) + Math.cos(B) * (Math.cos(A) * Math.sin(theta) - Math.cos(theta) * Math.sin(A) * Math.sin(phi)));
    }

    for (let phi = 0; phi < 2 * Math.PI; phi += (2 * Math.PI) / 360) {
      for (let theta = 0; theta < 2 * Math.PI; theta += (2 * Math.PI) / 20) {

        let next_x = compute_next_x(A, B, torus_radius, circle_radius, theta, phi, canvas);
        let next_y = compute_next_y(A, B, torus_radius, circle_radius, theta, phi, canvas);
        let next_z = compute_next_z(A, torus_radius, circle_radius, theta, phi);
        let texture_mapping_x = compute_map_texture_x(torus_radius, circle_radius, theta, phi);
        let texture_mapping_y = compute_map_texture_y(torus_radius, circle_radius, theta, phi);
        let luminance_value = compute_luminance(A, B, theta, phi);

        if (typeof zbuffer[next_x] == "undefined") {
          zbuffer[next_x] = Array();
        }

        if (typeof zbuffer[next_x][next_y] == "undefined") {
            zbuffer[next_x][next_y] = [next_z, next_x, next_y,
                                       texture_mapping_x, texture_mapping_y, luminance_value];
            continue;
        }

        if (zbuffer[next_x][next_y][0] < next_z) {
          continue;
        }
      }
    }

    for(let i in zbuffer) {
        for (let j in zbuffer[i]) {
          dest_x = Math.floor(zbuffer[i][j][1]);
          dest_y = Math.floor(zbuffer[i][j][2]);
          texture_map_x = Math.floor(zbuffer[i][j][3]);
          texture_map_y = Math.floor(zbuffer[i][j][4]);
          luminance_value = zbuffer[i][j][5];

          offscreenCtx.drawImage(donutTexture, texture_map_x, texture_map_y, 30, 30, dest_x, dest_y, 30, 30);
        }
    }

    ctx.drawImage(offscreenCanvas, (canvas.width  - offscreenCanvas.width) / 2, 0);
  }

  function draw(timestamp) {
    if (startTimestamp === undefined) {
      startTimestamp = timestamp;
    }

    const elapsed = timestamp - startTimestamp;
    doDrawTorus();

    window.requestAnimationFrame(draw);
  }

  donutTexture.addEventListener('load', function() {
    window.requestAnimationFrame(draw);
  });

  donutTexture.src = 'donut.jpeg';
}

document.addEventListener("DOMContentLoaded", drawDonut)

