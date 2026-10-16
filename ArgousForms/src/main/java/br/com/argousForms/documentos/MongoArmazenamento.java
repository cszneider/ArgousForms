package br.com.argousForms.documentos;

import java.io.InputStream;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import javax.servlet.ServletContext;

import org.bson.BsonString;
import org.bson.Document;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.MongoCredential;
import com.mongodb.WriteConcern;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.gridfs.GridFSBucket;
import com.mongodb.client.gridfs.GridFSBuckets;
import com.mongodb.client.gridfs.model.GridFSUploadOptions;

public final class MongoArmazenamento implements AutoCloseable {

	private final MongoClient cliente;
	private final MongoDatabase banco;
	private final GridFSBucket bucket;

	public MongoArmazenamento( ServletContext contexto ) throws Exception {

		MongoConfiguracao configuracao = MongoConfiguracao.carregar( contexto );
		MongoClientSettings opcoes = MongoClientSettings.builder()
			.applyConnectionString( new ConnectionString( configuracao.uri() ) )
			.credential( MongoCredential.createCredential( configuracao.usuario(), configuracao.bancoAutenticacao(), configuracao.senha() ) )
			.applyToClusterSettings( parametros -> parametros.serverSelectionTimeout( 3, TimeUnit.SECONDS ) )
			.applyToSocketSettings( parametros -> parametros.connectTimeout( 3, TimeUnit.SECONDS ).readTimeout( 30, TimeUnit.SECONDS ) )
			.writeConcern( WriteConcern.MAJORITY ).build();
		cliente = MongoClients.create( opcoes );
		banco = cliente.getDatabase( configuracao.banco() );
		bucket = GridFSBuckets.create( banco, configuracao.bucket() );
	}

	public void verificar() {

		banco.runCommand( new Document( "ping", 1 ) );
	}

	public void enviar( UUID idArquivo, UUID idVersao, String nome, String titulo, String contentType, InputStream conteudo ) {

		Document metadados = new Document( "idArquivo", idArquivo.toString() )
			.append( "idArquivoVersao", idVersao.toString() ).append( "titulo", titulo ).append( "contentType", contentType );
		bucket.uploadFromStream( new BsonString( idVersao.toString() ), nome, conteudo,
			new GridFSUploadOptions().metadata( metadados ) );
	}

	public void excluir( UUID idVersao ) {

		bucket.delete( new BsonString( idVersao.toString() ) );
	}

	@Override
	public void close() {

		cliente.close();
	}
}
