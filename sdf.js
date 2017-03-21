  this.go = function(connsTexture, vertsTexture, outTexture) {
    let outFrameBuffer;

    // Create and bind a framebuffer (for output)
    outFrameBuffer = gpgpUtility.attachFrameBuffer(outTexture);

    gl.useProgram(program);

    gpgpUtility.getStandardVertices();

    gl.vertexAttribPointer(positionHandle,     3, gl.FLOAT, gl.FALSE, 20, 0);  //
    gl.vertexAttribPointer(textureCoordHandle, 2, gl.FLOAT, gl.FALSE, 20, 12); //

    // Set up texture (conns)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, connsTexture);
    gl.uniform1i(textureConnsHandle, 0);

    // Set up texture (verts)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, vertsTexture);
    gl.uniform1i(textureVertsHandle, 1); // Check on this

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  };