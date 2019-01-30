var app = (function () {

  var gl;

  // The shader program object is also used to
  // store attribute and uniform locations.
  // noinspection SpellCheckingInspection
  var prog;

  // Array of model objects.
  var models = [];

  // Model that is target for user input.
  var interactiveModel;

  var camera = {
    // Function factory for the above translate, rotate functions.
    init: function () {
      ["translate", "rotateX", "rotateY", "rotateZ"].forEach(function (f) {
        camera[f] = function (val) {
          var M = mat4.create();
          mat4[f](M, M, val);
          mat4.multiply(this.vMatrix, M, this.vMatrix);
        }
      });
    },
    // Initial position of the camera.
    // NEW DAT
    eye: vec3.fromValues(0, 0, 0),
    //eye: [0, 0, 5],
    // Point to look at.
    center: [0, 0, 0],
    // Opening angle given in radian.
    // radian = degree*2*PI/360.
    fovy: 60.0 * Math.PI / 180,
    // Camera near plane dimensions:
    // value for left right top bottom in projection.
    lrtb: 2.0,
    // View matrix.
    vMatrix: mat4.create(),
    // Projection matrix.
    pMatrix: mat4.create(),
    // Projection types: orthoData, ortho, perspective, frustum.
    projectionType: "ortho",
    // Angle to Z-Axis for camera when orbiting in X-Z-plane.
    // given in radian.
    zAngle: 0,
    // Distance in XZ-Plane from center when orbiting.
    distance: 4,
    rotate: [0, 0, 0],

    rotateX: function (angle) {
      var M = mat4.create();
      mat4.rotateX(M, M, angle);
      mat4.multiply(this.vMatrix, M, this.vMatrix);
    },

    rotateY: function (angle) {
      var M = mat4.create();
      mat4.rotateY(M, M, angle);
      mat4.multiply(this.vMatrix, M, this.vMatrix);
    },

    rotateZ: function (angle) {
      var M = mat4.create();
      mat4.rotateZ(M, M, angle);
      mat4.multiply(this.vMatrix, M, this.vMatrix);
    },

    translate: function (vec) {
      var M = mat4.create();
      mat4.translate(M, M, vec);
      mat4.multiply(this.vMatrix, M, this.vMatrix);
    }

  };

  // Object with light sources characteristics in the scene.
  var illumination = {
    ambientLight: [.2, .2, .2],
    light: [{
      isOn: true,
      position: [-3., 1., -3.],
      color: [1., 1., 1.]
    }]
  };

  function start() {
    // NEW DAT
    Data.init();
    // Data.readFileFromServer('data/HabermansSurvivalDataSet/haberman.data');
    Data.readFileFromServer('data/HMP_Dataset/Getup_bed/Accelerometer-2011-03-29-09-21-17-getup_bed-f1.txt');
    init();
    render();
  }

  function init() {
    initWebGL();
    initShaderProgram();
    initUniforms();
    initModels();
    initEventHandler();
    initPipline();
    camera.init();
  }

  function initWebGL() {
    // Get canvas and WebGL context.
    var canvas = document.getElementById('canvas');
    gl = canvas.getContext('experimental-webgl');
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  }

  /**
   * Init pipeline parameters that will not change again.
   * If projection or viewport change,
   * their setup must be in render function.
   */
  function initPipline() {
    gl.clearColor(.95, .95, .95, 1);

    // Backface culling.
    gl.frontFace(gl.CCW);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // Depth(Z)-Buffer.
    gl.enable(gl.DEPTH_TEST);

    // Polygon offset of rastered Fragments.
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(0.5, 0);

    // Set viewport.
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    // Init camera.
    // Set projection aspect ratio.
    camera.aspect = gl.viewportWidth / gl.viewportHeight;
  }

  function initShaderProgram() {
    // Init vertex shader.
    var vs = initShader(gl.VERTEX_SHADER, "vertexshader");
    // Init fragment shader.
    var fs = initShader(gl.FRAGMENT_SHADER, "fragmentshader");
    // Link shader into a shader program.
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPosition");
    gl.linkProgram(prog);
    gl.useProgram(prog);
  }

  /**
   * Create and init shader from source.
   * @parameter shaderType: openGL shader type.
   * @parameter SourceTagId: Id of HTML Tag with shader source.
   * @returns WebGLShader.
   */
  function initShader(shaderType, SourceTagId) {
    var shader = gl.createShader(shaderType);
    var shaderSource = document.getElementById(SourceTagId).text;
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.log(SourceTagId + ": " + gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  function initUniforms() {
    // Projection Matrix.
    prog.pMatrixUniform = gl.getUniformLocation(prog, "uPMatrix");

    // Model-View-Matrix.
    prog.mvMatrixUniform = gl.getUniformLocation(prog, "uMVMatrix");

    // Normal Matrix.
    prog.nMatrixUniform = gl.getUniformLocation(prog, "uNMatrix");

    // Color.
    prog.colorUniform = gl.getUniformLocation(prog, "uColor");

    // Light.
    prog.ambientLightUniform = gl.getUniformLocation(prog, "ambientLight");
    // Array for light sources uniforms.
    prog.lightUniform = [];
    // Loop over light sources.
    for (var j = 0; j < illumination.light.length; j++) {
      var lightNb = "light[" + j + "]";
      // Store one object for every light source.
      var l = {};
      l.isOn = gl.getUniformLocation(prog, lightNb + ".isOn");
      l.position = gl.getUniformLocation(prog, lightNb + ".position");
      l.color = gl.getUniformLocation(prog, lightNb + ".color");
      prog.lightUniform[j] = l;
    }

    // Material.
    prog.materialKaUniform = gl.getUniformLocation(prog, "material.ka");
    prog.materialKdUniform = gl.getUniformLocation(prog, "material.kd");
    prog.materialKsUniform = gl.getUniformLocation(prog, "material.ks");
    prog.materialKeUniform = gl.getUniformLocation(prog, "material.ke");

    // Texture.
    prog.textureUniform = gl.getUniformLocation(prog, "uTexture");
  }

  function initTexture(model, filename) {
    var texture = gl.createTexture();
    model.texture = texture;
    texture.loaded = false;
    texture.image = new Image();
    texture.image.onload = function () {
      onloadTextureImage(texture);
    };
    texture.image.src = filename;
  }

  function onloadTextureImage(texture) {

    texture.loaded = true;

    // Use texture object.
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Assigen image data.
    //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);

    // Set texture parameter.
    // Wrap in S and T direction: CLAMP_TO_EDGE, REPEAT, MIRRORED_REPEAT
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    // Min Filter: NEAREST,LINEAR, .. , LINEAR_MIPMAP_LINEAR,
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    // Mag Filter: NEAREST,LINEAR
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Use mip-Mapping.
    gl.generateMipmap(gl.TEXTURE_2D);

    // Release texture object.
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Update the scene.
    render();
  }


  /**
   * @paramter material : object with optional  ka, kd, ks, ke.
   * @retrun material : object with ka, kd, ks, ke.
   */
  function createPhongMaterial(material) {
    material = material || {};
    // Set some default values,
    // if not defined in material parameter.
    material.ka = material.ka || [0.3, 0.3, 0.3];
    material.kd = material.kd || [0.6, 0.6, 0.6];
    material.ks = material.ks || [0.8, 0.8, 0.8];
    material.ke = material.ke || 10.;

    return material;
  }

  //NEW DAT
  function initModels() {
    // var fs = "fillwireframe";
    // var mBlue = createPhongMaterial({kd: [0., 0., 1.]});
    // createModel("sphere", fs, [1, 1, 1, 1], [0, 0, 0], [0, 0, 0], [.5, .5, .5], mBlue);
    // interactiveModel = models[0];
  }

  //NEW DAT
  // Create models from data.
  // Take first 3 fields as position.
  function initModelsFromData(data, stats) {
    var fs = "fill";

    var mRed = createPhongMaterial({
      kd: [1., 0., 0.]
    });

    var mGreen = createPhongMaterial({
      kd: [0., 1., 0.]
    });

    // Clear models for new data.
    models = [];

    for (var i = 0; i < data.length; i++) {

      var d = data[i];

      // Set color according to classification.
      var material = mGreen;

      // if (d[3] === 2) {
      //   material = mRed;
      // }

      // if (d[1] < 60 || d[1] > 63) {
      //   continue;
      // }

      // if (d[3] === 1) {
      //   continue;
      // }

      var pos = [d[0], d[1], d[2]];
      // Scale model according to data range and data set size ..
      var scale = stats.maxRange / 100;
      var scale3f = [scale, scale, scale];
      createModel("sphere", fs, [1, 1, 1, 1], pos, [0, 0, 0],
        scale3f, material);
    }
  }

  /**
   * Create model object, fill it and push it in models array.
   * @parameter geometryname: string with name of geometry.
   * @parameter fillstyle: wireframe, fill, fillwireframe.
   */
  function createModel(geometryname, fillstyle, color, translate, rotate, scale, material, textureFilename) {
    var model = {};
    model.fillstyle = fillstyle;
    model.color = color;
    initDataAndBuffers(model, geometryname);
    initTransformations(model, translate, rotate, scale);
    if (textureFilename) {
      initTexture(model, textureFilename);
    }
    model.material = material;

    models.push(model);
  }

  /**
   * Set scale, rotation and transformation for model.
   */
  function initTransformations(model, translate, rotate, scale) {
    // Store transformation vectors.
    model.translate = translate;
    model.rotate = rotate;
    model.scale = scale;

    // Create and initialize Model-Matrix.
    model.mMatrix = mat4.create();

    // Create and initialize Model-View-Matrix.
    model.mvMatrix = mat4.create();

    // Create and initialize Normal Matrix.
    model.nMatrix = mat3.create();
  }

  /**
   * Init data and buffers for model object.
   * @parameter model: a model object to augment with data.
   * @parameter geometryname: string with name of geometry.
   */
  function initDataAndBuffers(model, geometryname) {
    // Provide model object with vertex data arrays.
    // Fill data arrays for Vertex-Positions, Normals, Index data:
    // vertices, normals, indicesLines, indicesTris;
    // Pointer this refers to the window.
    this[geometryname]['createVertexData'].apply(model);

    // Setup position vertex buffer object.
    model.vboPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, model.vboPos);
    gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);
    // Bind vertex buffer to attribute variable.
    prog.positionAttrib = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(prog.positionAttrib);

    // Setup normal vertex buffer object.
    model.vboNormal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, model.vboNormal);
    gl.bufferData(gl.ARRAY_BUFFER, model.normals, gl.STATIC_DRAW);
    // Bind buffer to attribute variable.
    prog.normalAttrib = gl.getAttribLocation(prog, 'aNormal');
    gl.enableVertexAttribArray(prog.normalAttrib);

    //NEW DAT IF TEXTURE
    if (model.texture) {
      // Setup texture coordinat vertex buffer object.
      model.vboTextureCoord = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, model.vboTextureCoord);
      gl.bufferData(gl.ARRAY_BUFFER, model.textureCoord, gl.STATIC_DRAW);
      // Bind buffer to attribute variable.
      prog.textureCoordAttrib = gl.getAttribLocation(prog, 'aTextureCoord');
      gl.enableVertexAttribArray(prog.textureCoordAttrib);
    }

    // Setup lines index buffer object.
    model.iboLines = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboLines);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesLines, gl.STATIC_DRAW);
    model.iboLines.numberOfElements = model.indicesLines.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // Setup triangle index buffer object.
    model.iboTris = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboTris);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesTris, gl.STATIC_DRAW);
    model.iboTris.numberOfElements = model.indicesTris.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  function initEventHandler() {
    // Rotation step for models.
    var deltaRotate = Math.PI / 36;
    var deltaTranslate = 0.05;
    var deltaScale = 0.05;

    window.onkeydown = function (evt) {
      var key = evt.which ? evt.which : evt.keyCode;
      var c = String.fromCharCode(key);
      //console.log(evt);
      // Use shift key to change sign.
      var sign = evt.shiftKey ? -1 : 1;

      // Camera translation.
      var translateStep = camera.lrtb * sign * deltaTranslate;
      switch (c) {
        // Move the camera position.
        case ('W'):
          camera.translate([0, -translateStep, 0]);
          break;
        case ('A'):
          camera.translate([translateStep, 0, 0]);
          break;
        case ('S'):
          camera.translate([0, translateStep, 0]);
          break;
        case ('D'):
          camera.translate([-translateStep, 0, 0]);
          break;
        case (' '):
          camera.translate([0, 0, translateStep]);
          break;
      }

      // Rotate.
      var rotateStep = deltaRotate * sign;
      // Rotate interactiveModel.
      switch (c) {
        case ('X'):
          if (!interactiveModel)
            // camera.rotate[0] += rotateStep;
            camera.rotateX(rotateStep);
          else
            interactiveModel.rotate[0] += rotateStep;
          break;
        case ('Y'):
          if (!interactiveModel)
            // camera.rotate[1] += rotateStep;
            camera.rotateY(rotateStep);
          else
            interactiveModel.rotate[1] += rotateStep;
          break;
        case ('Z'):
          if (!interactiveModel)
            // camera.rotate[2] += rotateStep;
            camera.rotateZ(rotateStep);
          else
            interactiveModel.rotate[2] += rotateStep;
          break;
      }
      // Scale/squeese interactiveModel.
      switch (c) {
        case ('S'):
          interactiveModel.scale[0] *= 1 + sign * deltaScale;
          interactiveModel.scale[1] *= 1 - sign * deltaScale;
          interactiveModel.scale[2] *= 1 + sign * deltaScale;
          break;
      }

      // Change projection of scene.
      switch (c) {
        case ('O'):
          camera.projectionType = "ortho";
          camera.lrtb = 2;
          break;
        case ('F'):
          camera.projectionType = "frustum";
          camera.lrtb = 1.2;
          break;
        case ('P'):
          camera.projectionType = "perspective";
          break;
      }
      // Camera move and orbit.
      switch (c) {
        case ('C'):
          // Orbit camera around Y-Axis.
          camera.zAngle += sign * deltaRotate;
          break;
        case ('H'):
          // Move camera up and down.
          camera.eye[1] += sign * deltaTranslate;
          break;
        case ('D'):
          // Camera distance to center.
          camera.distance += sign * deltaTranslate;
          break;
        case ('V'):
          // Camera fovy in radian.
          camera.fovy += sign * 5 * Math.PI / 180;
          break;
        case ('B'):
          // Camera near plane dimensions.
          camera.lrtb *= 1.0 - sign * 0.1
          break;
      }

      // NEW DAT
      // Load data.
      switch (c) {
        case ('L'):
          Data.readFileFromClient();
          // No need to render.
          return;
      }

      // Render the scene again on any key pressed.
      render();
    };
  }

  /**
   * Run the rendering pipeline.
   */
  function render() {
    // Clear framebuffer and depth-/z-buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    setProjection();

    // NEW DAT
    //calculateCameraOrbit();

    // Set view matrix depending on camera.
    // NEW DAT
    //mat4.lookAt(camera.vMatrix, camera.eye, camera.center, camera.up);
    // NEW DAT
    // calculateCamera();

    // Set light uniforms.
    gl.uniform3fv(prog.ambientLightUniform, illumination.ambientLight);
    // Loop over light sources.
    for (var j = 0; j < illumination.light.length; j++) {
      // bool is transferred as integer.
      gl.uniform1i(prog.lightUniform[j].isOn, illumination.light[j].isOn ? 1 : 0);
      // Tranform light position in eye coordinates.
      // Copy current light position into a new array.
      var lightPos = [].concat(illumination.light[j].position);
      // Add homogeneous coordinate for transformation.
      lightPos.push(1.0);
      vec4.transformMat4(lightPos, lightPos, camera.vMatrix);
      // Remove homogeneous coordinate.
      lightPos.pop();
      gl.uniform3fv(prog.lightUniform[j].position, lightPos);
      gl.uniform3fv(prog.lightUniform[j].color, illumination.light[j].color);
    }

    // Loop over models.
    for (var i = 0; i < models.length; i++) {

      //NEW DAT IF TEXTURE
      if (models[i].texture && !models[i].texture.loaded) {
        // Leave out this model for now.
        // When the texture is loaded the onload will request a scene update.
        continue;
      }
      // Update modelview for model.
      updateTransformations(models[i]);

      // Set uniforms for model.
      //
      // Transformation matrices.
      gl.uniformMatrix4fv(prog.mvMatrixUniform, false, models[i].mvMatrix);
      gl.uniformMatrix3fv(prog.nMatrixUniform, false, models[i].nMatrix);
      // Color (not used with lights).
      gl.uniform4fv(prog.colorUniform, models[i].color);
      // Material.
      gl.uniform3fv(prog.materialKaUniform, models[i].material.ka);
      gl.uniform3fv(prog.materialKdUniform, models[i].material.kd);
      gl.uniform3fv(prog.materialKsUniform, models[i].material.ks);
      gl.uniform1f(prog.materialKeUniform, models[i].material.ke);
      //NEW  DAT
      //Texture.
      if (models[i].texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, models[i].texture);
        gl.uniform1i(prog.textureUniform, 0);
      }
      draw(models[i]);
    }
  }

  // NEW DAT
  function calculateCamera() {

    var vMatrix = camera.vMatrix;
    mat4.identity(vMatrix);

    // Rotate.
    mat4.rotateX(vMatrix, vMatrix, camera.rotate[0]);
    mat4.rotateY(vMatrix, vMatrix, camera.rotate[1]);
    mat4.rotateZ(vMatrix, vMatrix, camera.rotate[2]);

    // Translate.
    var trans = vec3.clone(camera.eye);
    vec3.scale(trans, trans, -1.0);
    mat4.translate(vMatrix, vMatrix, trans);
  }


  function calculateCameraOrbit() {
    // Calculate x,z position/eye of camera orbiting the center.
    var x = 0,
      z = 2;
    camera.eye[x] = camera.center[x];
    camera.eye[z] = camera.center[z];
    camera.eye[x] += camera.distance * Math.sin(camera.zAngle);
    camera.eye[z] += camera.distance * Math.cos(camera.zAngle);
  }

  // NEW DAT
  /*
      Consider only the first three fields of our data.
   */
  function initCameraFromData(stats) {

    camera.projectionType = "ortho";
    // camera.projectionType = "perspective";

    // Set Frustum according to data range.
    // Use same extend in all dimensions to keep data ratio.
    camera.lrtb = stats.maxRange;
    camera.distance = 0;

    // Locate the camera (eye) in the center of the data.
    // Data points inside the ortho frustum are all rendered.
    vec3.copy(camera.eye, stats.mean);

    var vMatrix = camera.vMatrix;
    mat4.identity(vMatrix);

    // Translate.
    var trans = vec3.clone(camera.eye);
    vec3.scale(trans, trans, -1.0);
    mat4.translate(vMatrix, vMatrix, trans);
  }

  function setProjection() {
    var v;
    // Set projection Matrix.
    switch (camera.projectionType) {
      // NEW DAT
      case ("ortho"):
        v = camera.lrtb;
        mat4.ortho(camera.pMatrix, -v, v, -v, v, -v, v);
        break;
      case ("frustum"):
        v = camera.lrtb;
        mat4.frustum(camera.pMatrix, -v / 2, v / 2, -v / 2, v / 2, 1, 10);
        break;
      case ("perspective"):
        mat4.perspective(camera.pMatrix, camera.fovy, camera.aspect, 1, camera.lrtb);
        break;
    }
    // Set projection uniform.
    gl.uniformMatrix4fv(prog.pMatrixUniform, false, camera.pMatrix);
  }

  /**
   * Update model-view matrix for model.
   */
  function updateTransformations(model) {

    // Use shortcut variables.
    var mMatrix = model.mMatrix;
    var mvMatrix = model.mvMatrix;

    // Reset matrices to identity.
    mat4.identity(mMatrix);
    mat4.identity(mvMatrix);

    // Translate.
    mat4.translate(mMatrix, mMatrix, model.translate);
    // Rotate.
    mat4.rotateX(mMatrix, mMatrix, model.rotate[0]);
    mat4.rotateY(mMatrix, mMatrix, model.rotate[1]);
    mat4.rotateZ(mMatrix, mMatrix, model.rotate[2]);
    // Scale
    mat4.scale(mMatrix, mMatrix, model.scale);

    // Combine view and model matrix
    // by matrix multiplication to mvMatrix.
    mat4.multiply(mvMatrix, camera.vMatrix, mMatrix);

    // Calculate normal matrix from model matrix.
    mat3.normalFromMat4(model.nMatrix, mvMatrix);
  }

  function draw(model) {
    // Setup position VBO.
    gl.bindBuffer(gl.ARRAY_BUFFER, model.vboPos);
    gl.vertexAttribPointer(prog.positionAttrib, 3, gl.FLOAT, false, 0, 0);

    // Setup normal VBO.
    gl.bindBuffer(gl.ARRAY_BUFFER, model.vboNormal);
    gl.vertexAttribPointer(prog.normalAttrib, 3, gl.FLOAT, false, 0, 0);

    //NEW DAT IF TEXTURE
    if (model.texture) {
      // Setup Texture VBO.
      gl.bindBuffer(gl.ARRAY_BUFFER, model.vboTextureCoord);
      gl.vertexAttribPointer(prog.textureCoordAttrib, 2, gl.FLOAT, false, 0, 0);
    }
    // Setup rendering tris.
    var fill = (model.fillstyle.search(/fill/) !== -1);
    if (fill) {
      gl.enableVertexAttribArray(prog.normalAttrib);
      //NEW DAT IF TEXTURE
      if (model.texture) {
        gl.enableVertexAttribArray(prog.textureCoordAttrib);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboTris);
      gl.drawElements(gl.TRIANGLES, model.iboTris.numberOfElements, gl.UNSIGNED_SHORT, 0);
    }

    // Setup rendering lines.
    var wireframe = (model.fillstyle.search(/wireframe/) !== -1);
    if (wireframe) {
      gl.uniform4fv(prog.colorUniform, [0., 0., 0., 1.]);
      gl.disableVertexAttribArray(prog.normalAttrib);
      //NEW DAT IF TEXTURE
      if (model.texture) {
        gl.disableVertexAttribArray(prog.textureCoordAttrib);
      }
      gl.vertexAttrib3f(prog.normalAttrib, 0, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboLines);
      gl.drawElements(gl.LINES, model.iboLines.numberOfElements, gl.UNSIGNED_SHORT, 0);
    }
  }

  // NEW DAT
  function dataLoadedCallback(data, stats) {

    initModelsFromData(data, stats);

    initCameraFromData(stats);

    render();
  }

  // App interface.
  return {
    start: start,
    // NEW DAT
    dataLoadedCallback: dataLoadedCallback
  };

}());
