const async = require('async');
const Book = require('../models/book');
const Author = require('../models/author');

// Display list of all Authors
exports.author_list = function(req, res, next) {

  Author.find()
    .sort([['family_name', 'ascending']])
    .exec(function (err, list_authors) {
      if (err) { return next(err); }
      //Successful, so render
      res.render('author_list', { title: 'Author List', author_list: list_authors });
    });

};

// Display detail page for a specific Author
exports.author_detail = function(req, res, next) {
  async.parallel({
  author: function(callback) {
    Author.findById(req.params.id)
      .exec(callback);
  },
  authors_books: function(callback) {
    Book.find({ 'author': req.params.id },'title summary')
      .exec(callback);
  },
}, function(err, results) {
  if (err) { return next(err); }
  //Successful, so render
  res.render('author_detail', { title: 'Author Detail', author: results.author, author_books: results.authors_books });
});
}


// Display Author create form on GET
exports.author_create_get = function(req, res) {
    res.render('author_form', {title: 'Create Author'});
};

// Handle Author create on POST
exports.author_create_post = function(req, res) {

    req.checkBody('first_name', 'First name must be specified.').notEmpty();//We won't force Alphanumeric, because people might have spaces.
    req.checkBody('family_name', 'Family name must be specified.').notEmpty();
    req.checkBody('family_name', 'Family name must be Alphanumeric.').isAlphanumeric();


    req.sanitize('first_name').escape();
    req.sanitize('family_name').escape();
    req.sanitize('first_name').trim();
    req.sanitize('family_name').trim();
    req.sanitize('date_of_birth').toDate();
    req.sanitize('date_of_dealth').toDate();

    var errors = req.validationErrors();

    var author = new Author(
      { first_name: req.body.first_name,
        family_name: req.body.family_name,
        date_of_birth: req.body.date_of_birth,
        date_of_death: req.body.date_of_death
       });

    if (errors) {
        res.render('author_form', { title: 'Create Author', author: author, errors: errors});
    return;
    }
    else {
    // Data from form is valid

        author.save(function (err) {
            if (err) { return next(err); }
               //successful - redirect to new author record.
               res.redirect(author.url);
            });
    }

};

// Display Author delete form on GET
exports.author_delete_get = function(req, res, next) {
    async.parallel({
      author: function(callback){
        Author.findById(req.params.id).exec(callback);
      },
      authors_books: function(callback){
        Book.find({'author': req.params.id }).exec(callback);
      },
    }, function(err, results){
      if(err){return next(err);}
      //Successful, so render
      res.render('author_delete', {title: 'Delete Author', author: results.author, author_books: results.authors_books});
    });
};

// Handle Author delete on POST
exports.author_delete_post = function(req, res) {
    req.checkBody('authorid', 'Author id must exist').notEmpty();

    async.parallel({
      author: function(callback){
        Author.findById(req.body.authorid).exec(callback);
      },
    }, function(err, results){
      if(err){ return next(err); }
      //successful
      if(results.authors_books.length > 0){
        //Author has books. Render in same way as for Get route.
        res.render('author_delete', {title: 'Delete Author', author: results.author, author_books: results.authors_books });
        return;
      }
      else{
        //Author has no books. Delete object and redirect to the list of authors.
        Author.findByIdAndRemove(req.body.authorid, function deleteAuthor(err){
          if(err){ return next(err); }
          //successful
          res.redirect('/catalog/authors');
        })
}

});

};

// Display Author update form on GET
exports.author_update_get = function(req, res) {
    res.send('NOT IMPLEMENTED: Author update GET');
};

// Handle Author update on POST
exports.author_update_post = function(req, res) {
    res.send('NOT IMPLEMENTED: Author update POST');
};
