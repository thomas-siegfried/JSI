var gulp = require('gulp');
var gjs = require('gulp-jasmine');
var concat = require('gulp-concat');
var ts = require('gulp-typescript');
var del = require('del');

var project = ts.createProject('tsconfig.json');

gulp.task('test', () => {
    return gulp.src(['build/Scripts/jsi.js', 'build/tests.js'])
        .pipe(concat('temp.js'))
        .pipe(gulp.dest('./build'))
        .pipe(gjs());
});


gulp.task('build', () => {
    var tsResult = gulp.src(['Content/**/*.ts', 'Tests/**/*.ts'])
        .pipe(project());
    tsResult.dts.pipe(gulp.dest('build'));
    return tsResult.js.pipe(gulp.dest('build'));
     
});

gulp.task('buildpackage', () => {
    var tsResult = gulp.src(['Content/**/*.ts'])
        .pipe(project());
    tsResult.dts.pipe(gulp.dest('build'));
    return tsResult.js.pipe(gulp.dest('build'));
});

gulp.task('clean', () => {
    return del([
        'build/**/*'
    ]);
});
 
gulp.task('default', gulp.series('clean', 'build', 'test'));

gulp.task('package', gulp.series('clean', 'buildpackage'));
