const Book = require('../models/book');
const Author = require('../models/author');
const Genre = require('../models/genre');
const BookInstance = require('../models/bookinstance');

const async = require('async');
const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');

exports.index = function(req, res){

    async.parallel({
      book_count: function(callback) {
        Book.count(callback);
      },
      book_instance_count: function(callback){
        BookInstance.count(callback);
      },
      book_instance_available_count: function(callback){
        BookInstance.count({status: 'Available'}, callback);
      },
      author_count: function(callback){
        Author.count(callback);
      },
      genre_count: function(callback){
        Genre.count(callback);
      },
    }, function(err, results){
      res.render('index', {title: 'Local Library Home', error: err, data: results});
    });
};

// Display list of all books
exports.book_list = function(req, res, next) {

    Book.find({}, 'title author')
      .populate('author')
      .exec(function(err, list_books){
        if(err){
          return next(err);
        }
        //Successful, so render
        res.render('book_list', {title: 'Book LIst', book_list: list_books});
      });
};

// Display detail page for a specific book
exports.book_detail = function(req, res, next) {
    async.parallel({
      book: function(callback){

        Book.findById(req.params.id)
          .populate('author')
          .populate('genre')
          .exec(callback);
      },
      book_instance: function(callback){

        BookInstance.find({'book': req.params.id})
          //.populate('book')
          .exec(callback);
      },
    }, function(err, results){
      if(err){
        return next(err);
      }
      //Successful, so render
      res.render('book_detail', {title: 'Title', book: results.book, book_instances: results.book_instance });
    });
};

// Display book create form on GET
exports.book_create_get = function(req, res, next) {
    //Get all authors and genres, which we can use for adding to our book.
    async.parallel({
      authors: function(callback){
        Author.find(callback);
      },
      genres: function(callback){
        Genre.find(callback);
      },
    }, function(err, results){
      if(err){return next(err);}
      res.render('book_form', {title: 'Create Book', authors: results.authors, genres: results.genres});
    });
};

// Handle book create on POST
exports.book_create_post = function(req, res, next) {
  req.checkBody('title', 'Title must not be empty.').notEmpty();
  req.checkBody('author', 'Author must not be empty').notEmpty();
  req.checkBody('summary', 'Summary must not be empty').notEmpty();
  req.checkBody('isbn', 'ISBN must not be empty').notEmpty();

  req.sanitize('title').escape();
  req.sanitize('author').escape();
  req.sanitize('summary').escape();
  req.sanitize('isbn').escape();
  req.sanitize('title').trim();
  req.sanitize('author').trim();
  req.sanitize('summary').trim();
  req.sanitize('isbn').trim();
  req.sanitize('genre').escape();

  var book = new Book({
    title: req.body.title,
    author: req.body.author,
    summary: req.body.summary,
    isbn: req.body.isbn,
    genre: (typeof req.body.genre==='undefined') ? [] : req.body.genre.split(",")
  });

  var errors = req.validationErrors();
  if(errors){
    //Some problems so we need to re-render our books

    //Get all authors and genres for form
    async.parallel({
      authors: function(callback){
        Author.find(callback);
      },
      genres: function(callback){
        Genre.find(callback);
      },
    }, function(err, results){
      if(err){return next(err); }

      //Mark our selected genres as checked
      for(i = 0; i < results.genres.length; i++){
        if(book.genre.indexOf(results.genres[i]._id) > -1){
          //Current genre is selected. Set "checked" flag.
          results.genres[i].checked='true';
        }
      }

      res.render('book_form', {title: 'Create Book', authors: results.authors, genres:results.genres, book: book, errors:errors});
    });

  }
  else{
    //Data from form is valid.
    //We could check if book exists already, but lets just save.

    book.save(function(err){
      if(err){return next(err); }
      //Successful - redirect to new book record.
      res.redirect(book.url);
    });
  }
};

// Display book delete form on GET
exports.book_delete_get = function(req, res, next) {
    async.parallel({
      book: function(callback){
        Book.findById(req.params.id).exec(callback);
      },
      book_bookinstances: function (callback) {
        BookInstance.find({'book': req.params.id}).exec(callback);
      },
    }, function(err, results){
      if(err){ return next(err); }
      //Successful
      res.render('book_delete', {title: 'Delete Book', book: results.book, book_bookinstances: results.book_bookinstances});
    });
};

// Handle book delete on POST
exports.book_delete_post = function(req, res) {

  req.checkBody('id', 'Book id must exist').notEmpty();

  async.parallel({
    book: function(callback){
      Book.findById(req.body.id).exec(callback);
    },
    book_bookinstances: function(callback){
      BookInstance.find({'book': req.body.id}, 'imprint status').exec(callback);
    },
  }, function(err, results){
    if(err){ return next(err); }
    //Successful
    if(results.book_bookinstances.length > 0){
      //Checked if book has instances.
      res.render('book_delete', {title: 'Delete Book', book: results.book, book_instances: results.book_bookinstances});
      return;
    }
    else{
      //Book has no instances. Remove book now
      Book.findByIdAndRemove(req.body.id, function deleteBook(err){
        if(err){return next(err); }
        //Successful - redirect to book list_
        res.redirect('/catalog/books');
      });
    }
  });

};

// Display book update form on GET
exports.book_update_get = function(req, res, next) {

    // Get book, authors and genres for form.
    async.parallel({
        book: function(callback) {
            Book.findById(req.params.id).populate('author').populate('genre').exec(callback);
        },
        authors: function(callback) {
            Author.find(callback);
        },
        genres: function(callback) {
            Genre.find(callback);
        },
        }, function(err, results) {
            if (err) { return next(err); }
            if (results.book==null) { // No results.
                var err = new Error('Book not found');
                err.status = 404;
                return next(err);
            }
            // Success
            // Mark our selected genres as checked
            for (var all_g_iter = 0; all_g_iter < results.genres.length; all_g_iter++) {
                for (var book_g_iter = 0; book_g_iter < results.book.genre.length; book_g_iter++) {
                    if (results.genres[all_g_iter]._id.toString()==results.book.genre[book_g_iter]._id.toString()) {
                        results.genres[all_g_iter].checked='true';
                    }
                }
            }
            res.render('book_form', { title: 'Update Book', authors:results.authors, genres:results.genres, book: results.book });
        });

};

// Handle book update on POST
exports.book_update_post = [

    // Convert the genre to an array
    (req, res, next) => {
        if(!(req.body.genre instanceof Array)){
            if(typeof req.body.genre==='undefined')
            req.body.genre=[];
            else
            req.body.genre=new Array(req.body.genre);
        }
        next();
    },

    // Validate fields
    body('title', 'Title must not be empty.').isLength({ min: 1 }).trim(),
    body('author', 'Author must not be empty.').isLength({ min: 1 }).trim(),
    body('summary', 'Summary must not be empty.').isLength({ min: 1 }).trim(),
    body('isbn', 'ISBN must not be empty').isLength({ min: 1 }).trim(),

    // Sanitize fields
    sanitizeBody('title').trim().escape(),
    sanitizeBody('author').trim().escape(),
    sanitizeBody('summary').trim().escape(),
    sanitizeBody('isbn').trim().escape(),
    sanitizeBody('genre.*').trim().escape(),

    // Process request after validation and sanitization
    (req, res, next) => {

        // Extract the validation errors from a request
        const errors = validationResult(req);

        // Create a Book object with escaped/trimmed data and old id.
        var book = new Book(
          { title: req.body.title,
            author: req.body.author,
            summary: req.body.summary,
            isbn: req.body.isbn,
            genre: (typeof req.body.genre==='undefined') ? [] : req.body.genre,
            _id:req.params.id //This is required, or a new ID will be assigned!
           });

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/error messages.

            // Get all authors and genres for form
            async.parallel({
                authors: function(callback) {
                    Author.find(callback);
                },
                genres: function(callback) {
                    Genre.find(callback);
                },
            }, function(err, results) {
                if (err) { return next(err); }

                // Mark our selected genres as checked
                for (let i = 0; i < results.genres.length; i++) {
                    if (book.genre.indexOf(results.genres[i]._id) > -1) {
                        results.genres[i].checked='true';
                    }
                }
                res.render('book_form', { title: 'Update Book',authors:results.authors, genres:results.genres, book: book, errors: errors.array() });
            });
            return;
        }
        else {
            // Data from form is valid. Update the record.
            Book.findByIdAndUpdate(req.params.id, book, {}, function (err,thebook) {
                if (err) { return next(err); }
                   // Successful - redirect to book detail page.
                   res.redirect(thebook.url);
                });
        }
    }
];
