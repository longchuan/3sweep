function Cylinder(x, y, parameters, edgeDetector) {
	Shape.call(this, x, y, parameters, edgeDetector);
	this.mesh.rotation.x = Math.PI/2;
	this.circle = new THREE.Line(new THREE.Geometry(), this.line.material);
	for (var i = 0; i < 41; i++) {
		this.circle.geometry.vertices
			.push(new THREE.Vector3(Math.cos(i*Math.PI/20), Math.sin(i*Math.PI/20), 0));
	}
	this.group = [];
}

Cylinder.prototype = Object.create(Shape.prototype);
Cylinder.prototype.constructor = Cylinder;

Cylinder.prototype.align = function(x,y) {
	this.scene.remove(this.circle);


	if(!this.constantRadius) {
		this.leftEdges = new THREE.Points(new THREE.Geometry(), new THREE.PointsMaterial( { color: 0x000000, depthTest: false, depthWrite: false, size: 3 } ));
		this.rightEdges = new THREE.Points(new THREE.Geometry(), new THREE.PointsMaterial( { color: 0x555555, depthTest: false, depthWrite: false, size: 3 } ));
		this.centers = [];
		this.centers.push(this.center);
	}


	var points = [];
	points.push(this.line.geometry.vertices[0]);
	points.push(this.line.geometry.vertices[1]);
	points.push(new THREE.Vector3(x,y,-500));

	this.frame.u.subVectors(points[1], points[0]).normalize();
	this.frame.v = new THREE.Vector3(-this.frame.u.y, this.frame.u.x, 0);
	this.frame.w = new THREE.Vector3(0, 0, 1);

	this.last.copy(points[2]);
	
	// change the frame
	var relativePt = new THREE.Vector3();
	relativePt.subVectors(this.last, this.center);

	// rotate the axis
	var m = new THREE.Matrix3();
	m.set( this.frame.u.x, this.frame.u.y, 0,
		  -this.frame.u.y, this.frame.u.x, 0,
						0,              0, 1 );
	relativePt.applyMatrix3(m);

	var radius =  points[1].distanceTo(points[0])/2;

	var distDiff = radius**2 - relativePt.length()**2;
	if(distDiff > 0) {
		var cos = relativePt.y / Math.sqrt( radius**2 - relativePt.x**2 );
		var cos_2 = Math.sqrt((1 + cos)/2);
		var sin_2 = Math.sqrt((1 - cos)/2);
		var rotation = new THREE.Quaternion(sin_2*this.frame.u.x, sin_2*this.frame.u.y, 0, cos_2);

		this.mesh.geometry = new THREE.CylinderGeometry(radius, radius, 1, 32);
		this.mesh.position.copy(this.center);
		this.mesh.applyQuaternion(rotation);

		this.frame.u.applyQuaternion(rotation);
		this.frame.v.applyQuaternion(rotation);
		this.frame.w.applyQuaternion(rotation);

		this.last.z += Math.sqrt(distDiff);

		this.group.push(this.mesh);

		return this.mesh;
	}
};

Cylinder.prototype.sweepConstant = function(x,y) {
	var direction = new THREE.Vector3(x - this.last.x, y - this.last.y, 0);
	var height = Math.abs( this.frame.w.dot(direction) );
	direction.normalize();

	height /= Math.sqrt(1 - this.frame.w.z**2);
	var vec = this.frame.w.clone();

	this.mesh.position.addVectors(this.center, vec.multiplyScalar(height/2));

	var q = new THREE.Quaternion();
	var w = new THREE.Vector3();
	w.crossVectors(this.frame.u, this.frame.v);
	if(w.dot(direction) > 0.95 || w.dot(direction) < -0.95) {
		w = new THREE.Vector3(this.frame.w.x, this.frame.w.y, 0);
		w.normalize();
		q.setFromUnitVectors(w, direction);
		this.mesh.applyQuaternion(q);
		this.frame.w.applyQuaternion(q);
	}

	var radius = this.mesh.geometry.parameters.radiusTop;
	this.mesh.geometry = new THREE.CylinderGeometry( radius, radius, height, 32 );
};


Cylinder.prototype.sweepVarying = function(x,y) {
	var direction = new THREE.Vector3(x - this.last.x, y - this.last.y, 0);
	var height = this.frame.w.dot(direction);
	direction.normalize();

	height /= Math.sqrt(1 - this.frame.w.z**2);
	var vec = this.frame.w.clone();
	var end = this.group.length - 1;

	var curPoint = new THREE.Vector3();
	var vec = this.frame.w.clone();
	curPoint.addVectors(this.center, vec.multiplyScalar(height));

	var h = curPoint.distanceTo( this.centers[this.centers.length - 1] );

	vec = this.frame.w.clone();
	this.group[end].position.addVectors(this.centers[this.centers.length - 1], vec.multiplyScalar( h/2 ));
	if(h > 5) {
		
		this.centers.push(curPoint);

		var edges = this.edgeDetector.bresenham(curPoint, this.line.geometry.vertices);
		
		this.leftEdges.geometry.vertices.push( edges.left );
		this.rightEdges.geometry.vertices.push( edges.right );

		var radiusBottom = this.group[end].geometry.parameters.radiusTop;
		var radiusTop = edges.radius;

		this.group[end].geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, h, 32);

		var material = this.group[end].material;
		var q = new THREE.Quaternion();
		q.setFromUnitVectors(new THREE.Vector3(0,1,0), this.frame.w);

		var mesh = new THREE.Mesh( new THREE.CylinderGeometry( radiusTop, radiusTop, 0.1, 32 ), material );
		mesh.applyQuaternion(q);
		mesh.position.copy(curPoint);
		this.scene.add(mesh);

		this.group.push( mesh );

	} else {

		var radiusBottom = this.group[end].geometry.parameters.radiusBottom;
		this.group[end].geometry = new THREE.CylinderGeometry( radiusBottom, radiusBottom, h, 32 );

	}

};


Cylinder.prototype.trace = function(x,y) {
	if(this.circle.position.z === 0){
		this.scene.remove(this.line);

		var points = this.line.geometry.vertices;
		this.center = points[1].clone().add(points[0]).divideScalar(2);
		this.circle.position.copy(this.center);

		var u = new THREE.Vector3();
		u.subVectors(points[1], points[0]).normalize();
		var angle = Math.acos(u.dot(new THREE.Vector3(1,0,0)));
		if(u.y > 0) this.circle.rotation.z = angle;
		else this.circle.rotation.z = -angle;

		this.circle.scale.x = points[0].distanceTo(points[1]) / 2;

		this.scene.add(this.circle);
	}
	var pos = new THREE.Vector3(x - this.center.x, y - this.center.y, 0);
	var radius = this.circle.scale.x;
	if(pos.length() < radius) {
		this.circle.scale.y = pos.y/Math.sqrt(1 - pos.x**2/radius**2);
	}
};
